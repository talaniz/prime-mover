import type { Store, Job, ProjectRecord } from "./store.js";
import { GitHubFailure, type GitHub } from "./github.js";
import { assessIssue, type IntakeDecision } from "./intake-policy.js";
import type { IssueSnapshot, LabelEvent, Page } from "./contracts.js";
export interface IntakeSnapshot {
  issue: IssueSnapshot;
  decision: IntakeDecision;
}
const terminal = new Set(["cancelled", "merged", "closed"]);
async function allPages<T>(
  read: (cursor?: string) => Promise<Page<T>>,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let pages = 0; pages < 100; pages++) {
    const page = await read(cursor);
    items.push(...page.items);
    if (!page.next) return items;
    if (seen.has(page.next)) throw new GitHubFailure("invalid-response");
    seen.add(page.next);
    cursor = page.next;
  }
  throw new GitHubFailure("invalid-response");
}
/** Intake never starts execution. It publishes only durable, currently authorized jobs. */
export class Intake {
  private readonly now: () => number;
  private readonly pollMs: number;
  constructor(
    private readonly store: Store,
    private readonly github: GitHub,
    private readonly options: {
      now?: () => number;
      pollMs?: number;
      interrupt?: (thread: string, turn: string) => Promise<void>;
    } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.pollMs = options.pollMs ?? 60000;
    if (!Number.isSafeInteger(this.pollMs) || this.pollMs < 1)
      throw new Error("Invalid poll interval");
  }
  private async snapshot(
    project: ProjectRecord,
    number: number,
  ): Promise<IntakeSnapshot> {
    const issue = await this.github.issue(project.repository, number);
    if (issue.number !== number) throw new GitHubFailure("invalid-response");
    const events: LabelEvent[] = await allPages((cursor) =>
      this.github.events(project.repository, number, cursor),
    );
    return { issue, decision: assessIssue(project, issue, events) };
  }
  private async interrupt(job: Job): Promise<void> {
    if (job.activeThreadId && job.activeTurnId && this.options.interrupt) {
      // An interrupt response is not proof that a turn ended. Keep the reservation
      // until the execution/recovery adapter reconciles authoritative turn history.
      try {
        await this.options.interrupt(job.activeThreadId, job.activeTurnId);
      } catch {
        /* Persisted stop state remains authoritative. */
      }
    }
  }
  private async validate(
    job: Job,
    project: ProjectRecord,
  ): Promise<IntakeSnapshot> {
    const snapshot = await this.snapshot(project, job.issue);
    if (!snapshot.decision.authorized) {
      if (!job.cancelRequested)
        this.store.cancel(
          job.id,
          snapshot.decision.reason ?? "authorization-withdrawn",
        );
      await this.interrupt(job);
    } else {
      const saved = job.snapshot as IntakeSnapshot;
      if (saved?.decision?.hash !== snapshot.decision.hash) {
        this.store.invalidateIntake(job.id, "contract-changed");
        await this.interrupt(job);
      }
    }
    return snapshot;
  }
  /** Required immediately before starting a turn or publishing task output. */
  async authorize(
    id: string,
    options: { allowOperationalBlock?: boolean } = {},
  ): Promise<IntakeSnapshot> {
    const job = this.store.job(id);
    if (!job || terminal.has(job.stage) || job.cancelRequested)
      throw new Error("Job is not authorized");
    const project = this.store
      .projects()
      .find((p) => p.id === job.projectId && p.enabled);
    if (!project) {
      this.store.cancel(id, "repository-not-allowed");
      await this.interrupt(job);
      throw new Error("Project is not authorized");
    }
    const snapshot = await this.validate(job, project);
    const current = this.store.job(id)!;
    if (
      !snapshot.decision.runnable ||
      current.cancelRequested ||
      snapshot.decision.hash !==
        (current.snapshot as IntakeSnapshot).decision.hash ||
      (current.blockCode &&
        current.blockCode !== "approval-required" &&
        (!options.allowOperationalBlock ||
          [
            "contract-changed",
            "requirements-missing",
            "ack-pending",
            "ack-uncertain",
          ].includes(current.blockCode)))
    )
      throw new Error("Issue needs authorization or contract reconciliation");
    return snapshot;
  }
  private async acknowledge(job: Job, snapshot: IntakeSnapshot): Promise<void> {
    let ack = this.store.intakeAck(job.id);
    if (!ack) {
      const actor = await this.github.identity();
      if (!actor) throw new GitHubFailure("authentication");
      const detail = snapshot.decision.runnable
        ? "Authorization and requirements recorded. Work is queued after this acknowledgment is confirmed."
        : "Blocked: provide nonempty Objective, Scope, Acceptance criteria, and Verification sections. An operator must explicitly reconcile the updated contract.";
      this.store.prepareIntakeAck(
        job.id,
        `Prime Mover job ${job.id}, generation ${job.generation}. ${detail}`,
        actor,
      );
      ack = this.store.intakeAck(job.id)!;
    }
    if (ack.state === "done") {
      this.store.releaseIntake(job.id);
      return;
    }
    const comments = await allPages((cursor) =>
      this.github.comments(job.repository, job.issue, cursor),
    );
    const matches = comments.filter(
      (c) =>
        c.actor.toLowerCase() === ack!.actor.toLowerCase() &&
        c.body === ack!.body,
    );
    if (matches.length > 1) throw new GitHubFailure("invalid-response");
    if (matches.length === 1)
      this.store.finishIntakeAck(job.id, matches[0]!.id);
    else if (ack.state === "sending") throw new GitHubFailure("unavailable");
    else {
      // Recheck authorization/content immediately before publishing the acknowledgment.
      const project = this.store
        .projects()
        .find((p) => p.id === job.projectId)!;
      const latest = await this.validate(this.store.job(job.id)!, project);
      if (
        !latest.decision.authorized ||
        latest.decision.hash !== snapshot.decision.hash
      )
        return;
      if (this.store.startIntakeAck(job.id)) {
        const remoteId = await this.github.comment(
          job.repository,
          job.issue,
          ack.body,
        );
        this.store.finishIntakeAck(job.id, remoteId);
      }
    }
    this.store.releaseIntake(job.id);
  }
  private async ingest(
    project: ProjectRecord,
    number: number,
    generation = 0,
    rerun?: { from: string; reason: string },
  ): Promise<string | null> {
    const existing = this.store
      .jobs()
      .filter((j) => j.projectId === project.id && j.issue === number)
      .sort((a, b) => b.generation - a.generation)[0];
    if (existing && !rerun) return existing.id;
    const snapshot = await this.snapshot(project, number);
    if (!snapshot.decision.authorized) return null;
    const id = this.store.enqueue(
      project.id,
      number,
      snapshot,
      generation,
      snapshot.decision.runnable ? "ack-pending" : "requirements-missing",
      rerun,
    );
    await this.acknowledge(this.store.job(id)!, snapshot);
    return id;
  }
  async poll(): Promise<void> {
    const projects = this.store.projects();
    for (const job of this.store.jobs().filter((j) => !terminal.has(j.stage))) {
      if (!projects.some((p) => p.id === job.projectId && p.enabled)) {
        if (!job.cancelRequested)
          this.store.cancel(job.id, "repository-not-allowed");
        await this.interrupt(job);
      }
    }
    await Promise.all(
      projects
        .filter((p) => p.enabled)
        .map(async (project) => {
          const state = this.store.pollState(project.id);
          if (state.nextAt > this.now()) return;
          try {
            // Monitor existing work even while intake is paused, and independently of
            // label-filtered discovery so closures/removals cannot disappear unnoticed.
            for (const job of this.store
              .jobs()
              .filter(
                (j) => j.projectId === project.id && !terminal.has(j.stage),
              )) {
              const snapshot = await this.validate(job, project);
              if (
                snapshot.decision.authorized &&
                !this.store.job(job.id)!.cancelRequested
              )
                await this.acknowledge(this.store.job(job.id)!, snapshot);
            }
            let cursor = project.checkpoint ?? undefined;
            if (!this.store.paused()) {
              const seen = new Set<string>();
              // Bound each repository's discovery slice to avoid starving other projects.
              for (let pageCount = 0; pageCount < 5; pageCount++) {
                const page = await this.github.issues(
                  project.repository,
                  cursor,
                );
                for (const item of page.items) {
                  if (
                    item.repository.toLowerCase() !==
                    project.repository.toLowerCase()
                  )
                    throw new GitHubFailure("invalid-response");
                  await this.ingest(project, item.number);
                }
                if (page.next && (seen.has(page.next) || page.next === cursor))
                  throw new GitHubFailure("invalid-response");
                if (page.next) seen.add(page.next);
                cursor = page.next ?? undefined;
                this.store.recordPoll(project.id, cursor ?? null, null, 0);
                if (!cursor) break;
              }
            }
            this.store.recordPoll(
              project.id,
              cursor ?? null,
              null,
              this.now() + this.pollMs,
            );
          } catch (error) {
            const failure =
              error instanceof GitHubFailure
                ? error
                : new GitHubFailure("unavailable");
            const delay = Math.min(
              3600000,
              this.pollMs * 2 ** Math.min(state.failures + 1, 10),
            );
            this.store.recordPoll(
              project.id,
              null,
              `github-${failure.kind}`,
              Math.max(this.now() + delay, failure.retryAt),
            );
            // Current authorization is unknown; active workers must not continue publishing.
            for (const job of this.store
              .jobs()
              .filter(
                (j) => j.projectId === project.id && !terminal.has(j.stage),
              ))
              await this.interrupt(job);
          }
        }),
    );
  }
  async reconcile(id: string, reason: string): Promise<void> {
    if (!reason.trim()) throw new Error("Explicit operator reason required");
    const job = this.store.job(id);
    const project = this.store
      .projects()
      .find((p) => p.id === job?.projectId && p.enabled);
    if (!job || !project) throw new Error("Unknown enabled project/job");
    const snapshot = await this.snapshot(project, job.issue);
    if (!snapshot.decision.runnable)
      throw new Error("Issue still lacks authorization or requirements");
    this.store.reconcileIntake(id, snapshot, reason);
  }
  async rerun(id: string, reason: string): Promise<string> {
    if (this.store.paused()) throw new Error("Intake is paused");
    if (!reason.trim()) throw new Error("Explicit operator reason required");
    const job = this.store.job(id);
    const project = this.store
      .projects()
      .find((p) => p.id === job?.projectId && p.enabled);
    if (
      !job ||
      !project ||
      !terminal.has(job.stage) ||
      job.leaseOwner ||
      job.activeTurnId ||
      this.store.operations(id).some((o) => o.status === "pending") ||
      this.store.intakeAck(id)?.state === "sending"
    )
      throw new Error("Prior generation needs reconciliation before rerun");
    const latest = this.store
      .jobs()
      .filter((j) => j.projectId === job.projectId && j.issue === job.issue)
      .sort((a, b) => b.generation - a.generation)[0]!;
    if (latest.id !== id)
      throw new Error("Rerun must reference the latest generation");
    const created = await this.ingest(project, job.issue, job.generation + 1, {
      from: id,
      reason,
    });
    if (!created) throw new Error("Issue is not authorized");
    return created;
  }
}
