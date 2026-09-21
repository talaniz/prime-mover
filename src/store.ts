import { backupDatabase, restoreDatabase } from "./backup.js";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { Reviews } from "./reviews.js";
import { readinessEvidence, type RemoteReadiness } from "./readiness.js";
import type { ProjectConfig } from "./config.js";
import type { JobStage } from "./contracts.js";

export type RecoveryStage =
  | "preparing"
  | "code-review"
  | "e2e-review"
  | "code-fixes"
  | "e2e-fixes"
  | "verifying";

export interface Lease {
  jobId: string;
  owner: string;
  epoch: number;
}
export interface Job {
  id: string;
  projectId: string;
  repository: string;
  issue: number;
  generation: number;
  snapshot: unknown;
  stage: JobStage;
  blockCode: string | null;
  attempts: number;
  leaseOwner: string | null;
  leaseEpoch: number;
  leaseUntil: number | null;
  activeThreadId: string | null;
  activeTurnId: string | null;
  cancelRequested: boolean;
  createdAt: number;
  updatedAt: number;
  prNumber: number | null;
}
export interface ProjectRecord extends ProjectConfig {
  configured: boolean;
  lastPollAt: number | null;
  checkpoint: string | null;
  blockCode: string | null;
}
export interface Operation {
  key: string;
  kind: string;
  status: "pending" | "done";
  input: unknown;
  result: unknown;
}
type Row = Record<string, unknown>;
const stages: JobStage[] = [
  "discovered",
  "authorized",
  "queued",
  "preparing",
  "implementing",
  "verifying",
  "pr-open",
  "code-review",
  "code-fixes",
  "e2e-review",
  "e2e-fixes",
  "ready",
  "waiting",
  "blocked",
  "cancelled",
  "merged",
  "closed",
];
const next: Partial<Record<JobStage, JobStage[]>> = {
  discovered: ["authorized"],
  authorized: ["queued"],
  queued: ["preparing"],
  preparing: ["implementing"],
  implementing: ["verifying"],
  verifying: ["implementing", "pr-open", "code-review"],
  "pr-open": ["code-review"],
  "code-review": ["code-fixes", "e2e-review"],
  "code-fixes": ["verifying", "code-review"],
  "e2e-review": ["e2e-fixes", "ready"],
  "e2e-fixes": ["verifying", "code-review"],
  ready: ["code-review", "merged", "closed"],
};
const terminal = new Set<JobStage>(["cancelled", "merged", "closed"]);
function reason(value: string): void {
  if (!value?.trim() || value.length > 1000)
    throw new Error("An explicit bounded operator reason is required");
}
function required(value: string): void {
  if (!value || value.length > 500 || /[\x00-\x1f]/.test(value))
    throw new Error("Invalid identifier");
}
function json(value: unknown): string {
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("JSON value required");
  return result;
}

/** Durable primitives. Production callers must pass mount preflight before opening. */
export class Store {
  private readonly db: DatabaseSync;
  private closed = false;
  constructor(
    filename: string,
    private readonly now: () => number = Date.now,
  ) {
    this.db = new DatabaseSync(filename);
    try {
      this.db.exec(
        "PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
      );
      this.transaction(() => {
        const version = this.one("PRAGMA user_version")?.user_version;
        if (version !== 0 && version !== 1 && version !== 2)
          throw new Error(
            "Unsupported database schema version; restore a compatible worker",
          );
        if (version === 0)
          this.db.exec(`
          CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          INSERT INTO settings VALUES ('paused','false');
          CREATE TABLE projects (
            id TEXT PRIMARY KEY, repository TEXT NOT NULL UNIQUE COLLATE NOCASE,
            config TEXT NOT NULL, enabled INTEGER NOT NULL, configured INTEGER NOT NULL DEFAULT 1,
            last_poll_at INTEGER, checkpoint TEXT, block_code TEXT, last_claim_at INTEGER NOT NULL DEFAULT 0
          );
          CREATE TABLE jobs (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
            repository TEXT NOT NULL COLLATE NOCASE, issue INTEGER NOT NULL CHECK(issue>0),
            generation INTEGER NOT NULL CHECK(generation>=0), snapshot TEXT NOT NULL,
            stage TEXT NOT NULL CHECK(stage IN (${stages.map((s) => `'${s}'`).join(",")})),
            block_code TEXT, attempts INTEGER NOT NULL DEFAULT 0,
            lease_owner TEXT, lease_epoch INTEGER NOT NULL DEFAULT 0, lease_until INTEGER,
            active_thread_id TEXT, active_turn_id TEXT, cancel_requested INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, pr_number INTEGER,
            retry_at INTEGER, resume_stage TEXT,
            UNIQUE(repository,issue,generation)
          );
          CREATE UNIQUE INDEX one_generation ON jobs(repository,issue)
            WHERE stage NOT IN ('cancelled','merged','closed');
          CREATE UNIQUE INDEX one_lease ON jobs((1)) WHERE lease_owner IS NOT NULL;
          CREATE UNIQUE INDEX one_turn ON jobs((1)) WHERE active_turn_id IS NOT NULL;
          CREATE TABLE events (id INTEGER PRIMARY KEY, job_id TEXT REFERENCES jobs(id),
            kind TEXT NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL);
          CREATE TRIGGER no_event_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'events are append-only'); END;
          CREATE TRIGGER no_event_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'events are append-only'); END;
          CREATE TABLE attempts (job_id TEXT NOT NULL REFERENCES jobs(id), number INTEGER NOT NULL,
            owner TEXT NOT NULL, epoch INTEGER NOT NULL, started_at INTEGER NOT NULL,
            PRIMARY KEY(job_id,number));
          CREATE TABLE operations (job_id TEXT NOT NULL REFERENCES jobs(id), key TEXT NOT NULL,
            kind TEXT NOT NULL, input TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','done')),
            result TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(job_id,key));
          CREATE TABLE budgets (job_id TEXT NOT NULL REFERENCES jobs(id), name TEXT NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(job_id,name));
          CREATE TABLE outbox (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
            kind TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
            remote_id TEXT, created_at INTEGER NOT NULL, UNIQUE(job_id,kind));
          PRAGMA user_version=1;
        `);
        if (version === 0 || version === 1)
          this.db.exec(`
          CREATE TABLE intake_polls (project_id TEXT PRIMARY KEY REFERENCES projects(id), next_at INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0);
          ALTER TABLE jobs ADD COLUMN intake_invalid INTEGER NOT NULL DEFAULT 0;
          CREATE TABLE intake_acks (job_id TEXT PRIMARY KEY REFERENCES jobs(id), marker TEXT NOT NULL UNIQUE, body TEXT NOT NULL, actor TEXT NOT NULL,
            state TEXT NOT NULL CHECK(state IN ('pending','sending','done')), remote_id TEXT);
          PRAGMA user_version=2;
        `);
      });
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  async backupTo(filename: string) {
    return backupDatabase(this.db, filename);
  }
  static async restoreBackup(source: string, destination: string) {
    return restoreDatabase(source, destination);
  }
  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.db.close();
    }
  }
  private one(sql: string, ...params: SQLInputValue[]): Row | undefined {
    return this.db.prepare(sql).get(...params) as Row | undefined;
  }
  private all(sql: string, ...params: SQLInputValue[]): Row[] {
    return this.db.prepare(sql).all(...params) as Row[];
  }
  private run(sql: string, ...params: SQLInputValue[]): void {
    this.db.prepare(sql).run(...params);
  }
  private transaction<T>(action: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private event(jobId: string | null, kind: string, detail: unknown): void {
    this.run(
      "INSERT INTO events(job_id,kind,detail,at) VALUES (?,?,?,?)",
      jobId,
      kind,
      json(detail),
      this.now(),
    );
  }
  seedProjects(projects: ProjectConfig[]): void {
    this.transaction(() => {
      this.run("UPDATE projects SET configured=0");
      for (const p of projects) {
        const existing = this.one(
          "SELECT repository FROM projects WHERE id=?",
          p.id,
        );
        if (
          existing &&
          String(existing.repository).toLowerCase() !==
            p.repository.toLowerCase()
        )
          throw new Error(
            "Project identity changed; explicit migration required",
          );
        this.run(
          `INSERT INTO projects(id,repository,config,enabled) VALUES (?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET config=excluded.config,configured=1`,
          p.id,
          p.repository,
          json(p),
          Number(p.enabled),
        );
      }
    });
  }
  projects(): ProjectRecord[] {
    return this.all(
      "SELECT * FROM projects WHERE configured=1 ORDER BY id",
    ).map((r) => ({
      ...(JSON.parse(String(r.config)) as ProjectConfig),
      enabled: Boolean(r.enabled),
      configured: Boolean(r.configured),
      lastPollAt: r.last_poll_at as number | null,
      checkpoint: r.checkpoint as string | null,
      blockCode: r.block_code as string | null,
    }));
  }
  setProjectEnabled(id: string, enabled: boolean): void {
    this.transaction(() => {
      if (!this.one("SELECT id FROM projects WHERE id=? AND configured=1", id))
        throw new Error("Unknown project");
      this.run("UPDATE projects SET enabled=? WHERE id=?", Number(enabled), id);
      this.event(null, "project-enabled", { id, enabled });
    });
  }
  updatePoll(
    id: string,
    checkpoint: string | null,
    blockCode: string | null,
  ): void {
    if (!this.one("SELECT id FROM projects WHERE id=? AND configured=1", id))
      throw new Error("Unknown project");
    if (blockCode)
      this.run("UPDATE projects SET block_code=? WHERE id=?", blockCode, id);
    else
      this.run(
        "UPDATE projects SET last_poll_at=?,checkpoint=?,block_code=NULL WHERE id=?",
        this.now(),
        checkpoint,
        id,
      );
  }
  enqueue(
    projectId: string,
    issue: number,
    snapshot: unknown,
    generation = 0,
    initialBlock: string | null = null,
    rerun?: { from: string; reason: string },
  ): string {
    if (
      !Number.isSafeInteger(issue) ||
      issue < 1 ||
      !Number.isSafeInteger(generation) ||
      generation < 0
    )
      throw new Error("Invalid issue/generation");
    return this.transaction(() => {
      const p = this.one(
        "SELECT * FROM projects WHERE id=? AND configured=1",
        projectId,
      );
      if (!p || !p.enabled) throw new Error("Project is not enabled");
      const existing = this.one(
        "SELECT id FROM jobs WHERE repository=? AND issue=? AND generation=?",
        String(p.repository),
        issue,
        generation,
      );
      if (existing) return String(existing.id);
      if (
        this.one(
          "SELECT id FROM jobs WHERE repository=? AND issue=? AND stage NOT IN ('cancelled','merged','closed')",
          String(p.repository),
          issue,
        )
      )
        throw new Error("Issue already has an active generation");
      if (rerun) {
        reason(rerun.reason);
        const previous = this.job(rerun.from);
        if (
          !previous ||
          previous.projectId !== projectId ||
          previous.issue !== issue ||
          previous.generation + 1 !== generation ||
          !terminal.has(previous.stage) ||
          previous.leaseOwner ||
          previous.activeTurnId ||
          this.hasPending(previous.id)
        )
          throw new Error("Prior generation needs reconciliation before rerun");
      }
      const id = randomUUID();
      this.run(
        "INSERT INTO jobs(id,project_id,repository,issue,generation,snapshot,stage,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
        id,
        projectId,
        String(p.repository),
        issue,
        generation,
        json(snapshot),
        "queued",
        this.now(),
        this.now(),
      );
      if (initialBlock)
        this.run(
          "UPDATE jobs SET stage='blocked',block_code=? WHERE id=?",
          initialBlock,
          id,
        );
      this.event(id, initialBlock ? "intake-blocked" : "queued", {
        generation,
        blockCode: initialBlock,
      });
      if (rerun)
        this.event(id, "operator-rerun", {
          from: rerun.from,
          reason: rerun.reason,
        });
      return id;
    });
  }
  pollState(projectId: string): { nextAt: number; failures: number } {
    const r = this.one(
      "SELECT * FROM intake_polls WHERE project_id=?",
      projectId,
    );
    return {
      nextAt: Number(r?.next_at ?? 0),
      failures: Number(r?.failures ?? 0),
    };
  }
  recordPoll(
    projectId: string,
    checkpoint: string | null,
    code: string | null,
    nextAt: number,
  ): void {
    this.transaction(() => {
      this.updatePoll(projectId, checkpoint, code);
      this.run(
        `INSERT INTO intake_polls VALUES (?,?,?) ON CONFLICT(project_id) DO UPDATE SET next_at=excluded.next_at,failures=excluded.failures`,
        projectId,
        nextAt,
        code ? this.pollState(projectId).failures + 1 : 0,
      );
    });
  }
  invalidateIntake(id: string, code: string): void {
    this.transaction(() => {
      const j = this.job(id);
      if (!j || terminal.has(j.stage)) return;
      this.run(
        "UPDATE jobs SET intake_invalid=1,stage='blocked',block_code=?,updated_at=? WHERE id=?",
        code,
        this.now(),
        id,
      );
      if (j.blockCode !== code) this.event(id, "intake-invalidated", { code });
    });
  }
  reconcileIntake(id: string, snapshot: unknown, why: string): void {
    reason(why);
    this.transaction(() => {
      const j = this.job(id);
      if (
        !j ||
        terminal.has(j.stage) ||
        j.leaseOwner ||
        j.activeTurnId ||
        j.cancelRequested ||
        this.hasPending(id)
      )
        throw new Error("Job needs remote reconciliation first");
      if (
        j.stage !== "blocked" ||
        (!this.one("SELECT intake_invalid FROM jobs WHERE id=?", id)
          ?.intake_invalid &&
          j.blockCode !== "requirements-missing")
      )
        throw new Error(
          "Only changed or incomplete contracts can be reconciled",
        );
      const ack = this.intakeAck(id);
      if (!ack || ack.state !== "done")
        throw new Error("Acknowledgment needs reconciliation first");
      this.run(
        "UPDATE jobs SET snapshot=?,stage='queued',block_code=NULL,intake_invalid=0,updated_at=? WHERE id=?",
        json(snapshot),
        this.now(),
        id,
      );
      this.event(id, "operator-contract-reconciled", { reason: why });
    });
  }
  intakeAck(id: string): {
    marker: string;
    body: string;
    actor: string;
    state: string;
    remoteId: string | null;
  } | null {
    const r = this.one("SELECT * FROM intake_acks WHERE job_id=?", id);
    return r
      ? {
          marker: String(r.marker),
          body: String(r.body),
          actor: String(r.actor),
          state: String(r.state),
          remoteId: r.remote_id as string | null,
        }
      : null;
  }
  prepareIntakeAck(id: string, body: string, actor: string): void {
    this.transaction(() => {
      if (this.intakeAck(id)) return;
      const marker = `<!-- prime-mover-intake:${randomUUID()} -->`;
      this.run(
        "INSERT INTO intake_acks VALUES (?,?,?,?,'pending',NULL)",
        id,
        marker,
        `${body}\n\n${marker}`,
        actor,
      );
      this.event(id, "intake-ack-intent", { marker, actor });
    });
  }
  startIntakeAck(id: string): boolean {
    return this.transaction(() => {
      if (this.intakeAck(id)?.state !== "pending") return false;
      this.run("UPDATE intake_acks SET state='sending' WHERE job_id=?", id);
      this.event(id, "intake-ack-sending", {});
      return true;
    });
  }
  finishIntakeAck(id: string, remoteId: string): void {
    required(remoteId);
    this.transaction(() => {
      const ack = this.intakeAck(id);
      if (!ack || (ack.remoteId && ack.remoteId !== remoteId))
        throw new Error("Acknowledgment identity mismatch");
      this.run(
        "UPDATE intake_acks SET state='done',remote_id=? WHERE job_id=?",
        remoteId,
        id,
      );
      if (ack.state !== "done")
        this.event(id, "intake-ack-confirmed", { remoteId });
    });
  }
  releaseIntake(id: string): void {
    this.transaction(() => {
      const j = this.job(id);
      if (
        !j ||
        j.cancelRequested ||
        this.intakeAck(id)?.state !== "done" ||
        this.one("SELECT intake_invalid FROM jobs WHERE id=?", id)
          ?.intake_invalid
      )
        return;
      if (
        j.stage === "blocked" &&
        ["ack-pending", "ack-uncertain"].includes(j.blockCode ?? "")
      ) {
        this.run(
          "UPDATE jobs SET stage='queued',block_code=NULL,updated_at=? WHERE id=?",
          this.now(),
          id,
        );
        this.event(id, "intake-authorized", {});
      }
    });
  }
  private decode(r: Row): Job {
    return {
      id: String(r.id),
      projectId: String(r.project_id),
      repository: String(r.repository),
      issue: Number(r.issue),
      generation: Number(r.generation),
      snapshot: JSON.parse(String(r.snapshot)),
      stage: r.stage as JobStage,
      blockCode: r.block_code as string | null,
      attempts: Number(r.attempts),
      leaseOwner: r.lease_owner as string | null,
      leaseEpoch: Number(r.lease_epoch),
      leaseUntil: r.lease_until as number | null,
      activeThreadId: r.active_thread_id as string | null,
      activeTurnId: r.active_turn_id as string | null,
      cancelRequested: Boolean(r.cancel_requested),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      prNumber: r.pr_number as number | null,
    };
  }
  job(id: string): Job | null {
    const r = this.one("SELECT * FROM jobs WHERE id=?", id);
    return r ? this.decode(r) : null;
  }
  jobs(): Job[] {
    return this.all("SELECT * FROM jobs ORDER BY created_at,id").map((r) =>
      this.decode(r),
    );
  }
  paused(): boolean {
    return (
      this.one("SELECT value FROM settings WHERE key='paused'")?.value ===
      "true"
    );
  }
  setPaused(paused: boolean): void {
    this.transaction(() => {
      this.run(
        "UPDATE settings SET value=? WHERE key='paused'",
        String(paused),
      );
      this.event(null, paused ? "intake-paused" : "intake-resumed", {});
    });
  }
  claim(owner: string, duration: number): Lease | null {
    required(owner);
    if (!Number.isSafeInteger(duration) || duration < 1)
      throw new Error("Invalid lease duration");
    return this.transaction(() => {
      if (
        this.paused() ||
        this.one(
          "SELECT id FROM jobs WHERE lease_owner IS NOT NULL OR active_turn_id IS NOT NULL",
        ) ||
        this.hasPending()
      )
        return null;
      const r = this.one(
        `SELECT j.id FROM jobs j JOIN projects p ON p.id=j.project_id
        WHERE (j.stage='queued' OR (j.stage='waiting' AND j.retry_at<=?)) AND j.cancel_requested=0 AND j.intake_invalid=0 AND p.enabled=1 AND p.configured=1 AND p.block_code IS NULL
        ORDER BY p.last_claim_at,j.created_at,j.id LIMIT 1`,
        this.now(),
      );
      if (!r) return null;
      const id = String(r.id);
      this.run(
        "UPDATE jobs SET stage=CASE WHEN stage='waiting' THEN COALESCE(resume_stage,'preparing') ELSE 'preparing' END,retry_at=NULL,lease_owner=?,lease_epoch=lease_epoch+1,lease_until=?,attempts=attempts+1,updated_at=? WHERE id=?",
        owner,
        this.now() + duration,
        this.now(),
        id,
      );
      const job = this.job(id)!;
      this.run(
        "UPDATE projects SET last_claim_at=? WHERE id=?",
        this.now(),
        job.projectId,
      );
      this.run(
        "INSERT INTO attempts VALUES (?,?,?,?,?)",
        id,
        job.attempts,
        owner,
        job.leaseEpoch,
        this.now(),
      );
      this.event(id, "claimed", { owner, epoch: job.leaseEpoch });
      return { jobId: id, owner, epoch: job.leaseEpoch };
    });
  }
  /** Adopt only local fencing; remote turns and pending sends remain reserved. */
  claimRecovery(id: string, owner: string, duration: number): Lease {
    required(owner);
    if (!Number.isSafeInteger(duration) || duration < 1)
      throw new Error("Invalid recovery lease duration");
    return this.transaction(() => {
      const job = this.job(id);
      if (
        !job ||
        terminal.has(job.stage) ||
        ["queued", "discovered", "authorized", "ready"].includes(job.stage)
      )
        throw new Error("Job does not require execution recovery");
      if (
        job.leaseOwner &&
        (job.leaseUntil === null || job.leaseUntil > this.now())
      )
        throw new Error("Live lease cannot be adopted before expiry");
      if (
        this.one(
          "SELECT id FROM jobs WHERE id<>? AND (lease_owner IS NOT NULL OR active_turn_id IS NOT NULL)",
          id,
        ) ||
        this.one(
          "SELECT job_id FROM operations WHERE job_id<>? AND status='pending'",
          id,
        ) ||
        this.one(
          "SELECT job_id FROM outbox WHERE job_id<>? AND status='pending'",
          id,
        )
      )
        throw new Error("Another reservation requires recovery first");
      const epoch = job.leaseEpoch + 1,
        attempt = job.attempts + 1;
      this.run(
        "UPDATE jobs SET lease_owner=?,lease_epoch=?,lease_until=?,attempts=?,updated_at=? WHERE id=?",
        owner,
        epoch,
        this.now() + duration,
        attempt,
        this.now(),
        id,
      );
      this.run(
        "INSERT INTO attempts VALUES (?,?,?,?,?)",
        id,
        attempt,
        owner,
        epoch,
        this.now(),
      );
      this.event(id, "recovery-claimed", {
        previousOwner: job.leaseOwner,
        owner,
        epoch,
        remoteReservationRetained: true,
      });
      return { jobId: id, owner, epoch };
    });
  }
  /** Recover the pre-intent crash window without giving a restart a fresh deadline. */
  recoverExecutionBudget(lease: Lease, jobSeconds: number): number {
    if (!Number.isSafeInteger(jobSeconds) || jobSeconds < 1)
      throw new Error("Invalid recovery time budget");
    return this.transaction(() => {
      const job = this.assertWorker(lease);
      const operations = this.operations(job.id);
      const prior = operations.find((o) => o.key === "implementation-budget");
      if (prior) {
        const deadline = (prior.input as { deadline?: number } | null)
          ?.deadline;
        if (
          prior.kind !== "execution-budget" ||
          !Number.isSafeInteger(deadline) ||
          Number(deadline) <= this.now()
        )
          throw new Error("Recovery execution budget exhausted or invalid");
        return Number(deadline);
      }
      if (
        operations.length ||
        this.hasPending(job.id) ||
        job.activeThreadId ||
        job.activeTurnId ||
        job.prNumber !== null
      )
        throw new Error(
          "Missing execution budget with recorded intents requires reconciliation",
        );
      const first = this.one(
        "SELECT MIN(started_at) AS started FROM attempts WHERE job_id=?",
        job.id,
      );
      const started = first?.started;
      const deadline = Number(started) + jobSeconds * 1000;
      if (
        started === null ||
        started === undefined ||
        !Number.isSafeInteger(deadline) ||
        deadline <= this.now()
      )
        throw new Error("Recovery execution deadline exhausted or missing");
      const budget = { deadline };
      this.run(
        "INSERT INTO operations VALUES (?, 'implementation-budget', 'execution-budget', ?, 'done', ?, ?, ?)",
        job.id,
        json(budget),
        json(budget),
        this.now(),
        this.now(),
      );
      this.event(job.id, "operation-intent", {
        key: "implementation-budget",
        kind: "execution-budget",
      });
      this.event(job.id, "operation-result", { key: "implementation-budget" });
      this.event(job.id, "execution-budget-recovered", {
        startedAt: Number(started),
        deadline,
      });
      return deadline;
    });
  }
  /** Continue recorded workflow only after the caller refreshes authorization/evidence. */
  resumeRecovery(lease: Lease, stage: RecoveryStage, limit: number): void {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      ![
        "preparing",
        "code-review",
        "e2e-review",
        "code-fixes",
        "e2e-fixes",
        "verifying",
      ].includes(stage)
    )
      throw new Error("Invalid recovery contract");
    this.transaction(() => {
      const job = this.assertWorker(lease);
      const deadline = (
        this.operations(job.id).find((o) => o.key === "implementation-budget")
          ?.input as { deadline?: number } | undefined
      )?.deadline;
      if (!Number.isSafeInteger(deadline) || Number(deadline) <= this.now())
        throw new Error("Recovery execution budget exhausted or missing");
      if ((stage === "preparing") !== (job.prNumber === null))
        throw new Error("Recovery stage does not match publication state");
      const prior = this.events(job.id).find(
        (e) =>
          e.kind === "recovery-resumed" &&
          (e.detail as { epoch?: number }).epoch === lease.epoch,
      );
      if (prior) {
        const record = prior.detail as {
          stage: string;
          deadline: number;
          limit: number;
        };
        if (
          record.stage !== stage ||
          record.deadline !== deadline ||
          record.limit !== limit
        )
          throw new Error("Recovery intent mismatch");
        return;
      }
      const used = Number(
        this.one(
          "SELECT used FROM budgets WHERE job_id=? AND name='recovery-attempts'",
          job.id,
        )?.used ?? 0,
      );
      if (used >= limit) throw new Error("Recovery attempt budget exhausted");
      this.run(
        "INSERT INTO budgets(job_id,name,used) VALUES (?,'recovery-attempts',?) ON CONFLICT(job_id,name) DO UPDATE SET used=excluded.used",
        job.id,
        used + 1,
      );
      this.run(
        "UPDATE jobs SET stage=?,block_code=NULL,resume_stage=NULL,retry_at=NULL,updated_at=? WHERE id=?",
        stage,
        this.now(),
        job.id,
      );
      this.event(job.id, "recovery-resumed", {
        epoch: lease.epoch,
        stage,
        deadline,
        limit,
        attempt: used + 1,
      });
    });
  }
  /** Ownership only: permits observation and stopping after authorization is withdrawn. */
  assertRecoveryLease(lease: Lease): Job {
    return this.assertLease(lease);
  }
  private assertLease(lease: Lease): Job {
    const j = lease && this.job(lease.jobId);
    if (
      !j ||
      j.leaseOwner !== lease.owner ||
      j.leaseEpoch !== lease.epoch ||
      j.leaseUntil === null ||
      j.leaseUntil <= this.now()
    )
      throw new Error(
        "Lost or expired lease; reconcile remote work before retry",
      );
    return j;
  }
  heartbeat(lease: Lease, duration: number): void {
    if (!Number.isSafeInteger(duration) || duration < 1)
      throw new Error("Invalid lease duration");
    this.transaction(() => {
      this.assertLease(lease);
      this.run(
        "UPDATE jobs SET lease_until=? WHERE id=?",
        this.now() + duration,
        lease.jobId,
      );
    });
  }
  transition(lease: Lease, stage: JobStage, blockCode?: string): void {
    this.transaction(() => {
      const j = this.assertLease(lease);
      if (!["blocked", "cancelled"].includes(stage)) this.assertWorker(lease);
      if (
        !stages.includes(stage) ||
        terminal.has(j.stage) ||
        (!(next[j.stage] ?? []).includes(stage) &&
          !["waiting", "blocked", "cancelled"].includes(stage))
      )
        throw new Error("Invalid job transition");
      if (
        stage === "code-review" &&
        j.stage === "verifying" &&
        j.prNumber === null
      )
        throw new Error("Correction review requires an existing PR");
      if (stage === "e2e-review") {
        if (j.activeTurnId || this.hasPending(j.id))
          throw new Error(
            "Active review or pending work requires reconciliation",
          );
        const reviews = new Reviews(this);
        const target = reviews.current(j.id);
        if (!target)
          throw new Error("Current-head code-review sign-off is required");
        reviews.requireCodeSignoff(j.id, target);
      }
      if (stage === "ready")
        throw new Error(
          "Readiness requires independently verified E2E and current remote evidence",
        );
      if (j.activeTurnId && terminal.has(stage))
        throw new Error("Cannot finish job with an active turn");
      if (
        j.cancelRequested &&
        !["cancelled", "blocked", "waiting"].includes(stage)
      )
        throw new Error(
          "Cancellation requested; reconcile before further work",
        );
      this.run(
        "UPDATE jobs SET stage=?,block_code=?,updated_at=? WHERE id=?",
        stage,
        blockCode ?? null,
        this.now(),
        j.id,
      );
      this.event(j.id, "transition", { from: j.stage, to: stage });
    });
  }
  beginTurn(lease: Lease, threadId: string, turnId: string): void {
    required(threadId);
    required(turnId);
    this.transaction(() => {
      const j = this.assertWorker(lease);
      if (this.one("SELECT id FROM jobs WHERE active_turn_id IS NOT NULL"))
        throw new Error("There is already an active turn");
      this.run(
        "UPDATE jobs SET active_thread_id=?,active_turn_id=?,updated_at=? WHERE id=?",
        threadId,
        turnId,
        this.now(),
        j.id,
      );
      this.event(j.id, "turn-recorded", { threadId, turnId });
    });
  }
  setApprovalWait(lease: Lease, waiting: boolean): void {
    this.transaction(() => {
      const j = this.assertWorker(lease);
      if (!j.activeTurnId)
        throw new Error("Approval wait requires an active turn");
      if (waiting && j.stage !== "waiting") {
        this.run(
          "UPDATE jobs SET resume_stage=stage,stage='waiting',block_code='approval-required',updated_at=? WHERE id=?",
          this.now(),
          j.id,
        );
        this.event(j.id, "approval-wait", {});
      } else if (!waiting && j.stage === "waiting") {
        const stage = this.one(
          "SELECT resume_stage FROM jobs WHERE id=?",
          j.id,
        )?.resume_stage;
        if (typeof stage !== "string" || !stages.includes(stage as JobStage))
          throw new Error("Missing execution resume stage");
        this.run(
          "UPDATE jobs SET stage=?,resume_stage=NULL,block_code=NULL,updated_at=? WHERE id=?",
          stage,
          this.now(),
          j.id,
        );
        this.event(j.id, "approval-resolved", {});
      }
    });
  }
  resumeCompletedApproval(lease: Lease): void {
    this.transaction(() => {
      const j = this.assertWorker(lease);
      if (j.stage !== "waiting" || j.activeTurnId)
        throw new Error("Approval turn is not complete");
      const stage = this.one(
        "SELECT resume_stage FROM jobs WHERE id=?",
        j.id,
      )?.resume_stage;
      if (typeof stage !== "string" || !stages.includes(stage as JobStage))
        throw new Error("Missing execution resume stage");
      this.run(
        "UPDATE jobs SET stage=?,resume_stage=NULL,block_code=NULL,updated_at=? WHERE id=?",
        stage,
        this.now(),
        j.id,
      );
      this.event(j.id, "approval-turn-completed", {});
    });
  }
  /** Operator continuation after the caller verifies the recorded remote turn completed. */
  reclaimPublication(
    id: string,
    owner: string,
    duration: number,
    why: string,
    proof?: { threadId: string; turnId: string },
  ): Lease {
    reason(why);
    required(owner);
    if (!Number.isSafeInteger(duration) || duration < 1)
      throw new Error("Invalid lease duration");
    return this.transaction(() => {
      const j = this.job(id);
      const ops = this.operations(id);
      const turn = ops.find((o) => o.key === "implementation-0:turn");
      const verifiedReservation = Boolean(
        j &&
          proof &&
          turn?.status === "done" &&
          proof.threadId === j.activeThreadId &&
          proof.turnId === (turn.result as { turnId: string }).turnId &&
          (!j.activeTurnId || j.activeTurnId === proof.turnId) &&
          (!j.leaseOwner ||
            (j.leaseUntil !== null && j.leaseUntil <= this.now())),
      );
      if (
        !j ||
        j.stage !== "blocked" ||
        j.cancelRequested ||
        ((j.activeTurnId || j.leaseOwner) && !verifiedReservation) ||
        !j.activeThreadId ||
        turn?.status !== "done" ||
        this.one("SELECT intake_invalid FROM jobs WHERE id=?", id)
          ?.intake_invalid
      )
        throw new Error("Job needs remote or contract reconciliation first");
      if (
        ops.some(
          (o) =>
            o.status === "pending" &&
            !["commit", "push", "pull-create", "verification"].includes(o.kind),
        )
      )
        throw new Error("Pending execution requires remote reconciliation");
      if (
        this.one(
          "SELECT id FROM jobs WHERE id<>? AND (lease_owner IS NOT NULL OR active_turn_id IS NOT NULL)",
          id,
        ) ||
        this.one(
          "SELECT job_id FROM operations WHERE status='pending' AND job_id<>?",
          id,
        ) ||
        this.one("SELECT job_id FROM outbox WHERE status='pending'")
      )
        throw new Error("Another reservation requires reconciliation");
      if (this.paused()) throw new Error("Intake is paused");
      const p = this.one("SELECT * FROM projects WHERE id=?", j.projectId);
      if (!p?.enabled || !p.configured || p.block_code)
        throw new Error("Project is unavailable");
      const epoch = j.leaseEpoch + 1,
        attempt = j.attempts + 1;
      this.run(
        "UPDATE jobs SET stage='preparing',block_code=NULL,active_turn_id=NULL,lease_owner=?,lease_epoch=?,lease_until=?,attempts=?,updated_at=? WHERE id=?",
        owner,
        epoch,
        this.now() + duration,
        attempt,
        this.now(),
        id,
      );
      this.run(
        "INSERT INTO attempts VALUES (?,?,?,?,?)",
        id,
        attempt,
        owner,
        epoch,
        this.now(),
      );
      this.event(id, "operator-publication-resume", {
        reason: why,
        reconciledTurn: verifiedReservation ? proof!.turnId : null,
        owner,
        epoch,
      });
      return { jobId: id, owner, epoch };
    });
  }
  reclaimCodeReview(
    id: string,
    owner: string,
    duration: number,
    why: string,
    proof: { threadId: string; turnId: string },
  ): Lease {
    reason(why);
    required(owner);
    if (!Number.isSafeInteger(duration) || duration < 1)
      throw new Error("Invalid review lease");
    return this.transaction(() => {
      const job = this.job(id),
        ops = this.operations(id),
        last = ops.filter((o) => o.kind === "turn-start").at(-1);
      if (
        !job ||
        job.stage !== "blocked" ||
        job.prNumber === null ||
        job.cancelRequested ||
        !proof ||
        last?.status !== "done" ||
        (last.input as { threadId: string }).threadId !== proof.threadId ||
        (last.result as { turnId: string }).turnId !== proof.turnId ||
        job.activeThreadId !== proof.threadId ||
        (job.activeTurnId && job.activeTurnId !== proof.turnId) ||
        (job.leaseOwner &&
          (job.leaseUntil === null || job.leaseUntil > this.now())) ||
        this.one("SELECT intake_invalid FROM jobs WHERE id=?", id)
          ?.intake_invalid
      )
        throw new Error(
          "Exact completed review-task proof and reconciliation are required",
        );
      const allowed = [
        "code-review-round",
        "review-cycle",
        "coordinator-task",
        "review-triage",
        "review-fix",
        "pr-comment",
        "commit",
        "push",
        "pull-create",
        "verification",
      ];
      if (ops.some((o) => o.status === "pending" && !allowed.includes(o.kind)))
        throw new Error("Pending task creation requires reconciliation");
      if (
        this.paused() ||
        this.one(
          "SELECT id FROM jobs WHERE id<>? AND (lease_owner IS NOT NULL OR active_turn_id IS NOT NULL)",
          id,
        ) ||
        this.one(
          "SELECT job_id FROM operations WHERE job_id<>? AND status='pending'",
          id,
        ) ||
        this.one("SELECT job_id FROM outbox WHERE status='pending'")
      )
        throw new Error("Another reservation requires reconciliation");
      const project = this.one(
        "SELECT * FROM projects WHERE id=?",
        job.projectId,
      );
      if (!project?.enabled || !project.configured || project.block_code)
        throw new Error("Review project is unavailable");
      const epoch = job.leaseEpoch + 1,
        attempt = job.attempts + 1;
      this.run(
        "UPDATE jobs SET stage='code-review',block_code=NULL,active_turn_id=NULL,lease_owner=?,lease_epoch=?,lease_until=?,attempts=?,updated_at=? WHERE id=?",
        owner,
        epoch,
        this.now() + duration,
        attempt,
        this.now(),
        id,
      );
      this.run(
        "INSERT INTO attempts VALUES (?,?,?,?,?)",
        id,
        attempt,
        owner,
        epoch,
        this.now(),
      );
      this.event(id, "operator-review-resume", {
        reason: why,
        owner,
        epoch,
        proof,
      });
      return { jobId: id, owner, epoch };
    });
  }
  claimCodeReview(id: string, owner: string, duration: number): Lease {
    return this.claimReview(id, owner, duration, "code-review");
  }
  claimE2EReview(id: string, owner: string, duration: number): Lease {
    return this.claimReview(id, owner, duration, "e2e-review");
  }
  private claimReview(
    id: string,
    owner: string,
    duration: number,
    role: "code-review" | "e2e-review",
  ): Lease {
    required(owner);
    if (!Number.isSafeInteger(duration) || duration < 1)
      throw new Error("Invalid review claim duration");
    return this.transaction(() => {
      const job = this.job(id);
      if (
        !job ||
        job.stage !== (role === "code-review" ? "pr-open" : "e2e-review") ||
        job.prNumber === null ||
        job.cancelRequested ||
        this.one("SELECT intake_invalid FROM jobs WHERE id=?", id)
          ?.intake_invalid
      )
        throw new Error(
          "Review claim requires a published authorized implementation",
        );
      if (
        this.paused() ||
        this.one(
          "SELECT id FROM jobs WHERE lease_owner IS NOT NULL OR active_turn_id IS NOT NULL",
        ) ||
        this.hasPending()
      )
        throw new Error(
          "Review claim blocked by pause or outstanding reservation",
        );
      const project = this.one(
        "SELECT * FROM projects WHERE id=?",
        job.projectId,
      );
      if (!project?.enabled || !project.configured || project.block_code)
        throw new Error("Review claim project is unavailable");
      if (role === "e2e-review") {
        const reviews = new Reviews(this),
          target = reviews.current(id);
        if (!target)
          throw new Error("Current-head code-review sign-off is required");
        reviews.requireCodeSignoff(id, target);
      }
      const epoch = job.leaseEpoch + 1,
        attempt = job.attempts + 1;
      this.run(
        "UPDATE jobs SET stage=?,block_code=NULL,lease_owner=?,lease_epoch=?,lease_until=?,attempts=?,updated_at=? WHERE id=?",
        role,
        owner,
        epoch,
        this.now() + duration,
        attempt,
        this.now(),
        id,
      );
      this.run(
        "INSERT INTO attempts VALUES (?,?,?,?,?)",
        id,
        attempt,
        owner,
        epoch,
        this.now(),
      );
      this.event(id, `${role}-claimed`, { owner, epoch });
      return { jobId: id, owner, epoch };
    });
  }
  finishReady(lease: Lease, remote: RemoteReadiness): void {
    this.transaction(() => {
      const job = this.assertWorker(lease);
      if (
        job.stage !== "e2e-review" ||
        job.activeTurnId ||
        this.hasPending(job.id)
      )
        throw new Error(
          "Readiness requires reconciled E2E and no pending work",
        );
      const evidence = readinessEvidence(
        this,
        job.id,
        remote,
        this.now(),
        true,
      );
      const key = `readiness:${lease.epoch}`;
      this.run(
        "INSERT INTO operations VALUES (?,?,?,?, 'done',?,?,?)",
        job.id,
        key,
        "readiness-evidence",
        json(evidence),
        json(evidence),
        this.now(),
        this.now(),
      );
      this.run(
        "UPDATE jobs SET stage='ready',lease_owner=NULL,lease_until=NULL,updated_at=? WHERE id=?",
        this.now(),
        job.id,
      );
      this.event(job.id, "ready", { head: remote.head, base: remote.base });
    });
  }
  revokeReadiness(id: string, code: string): void {
    if (!/^[a-z0-9-]{1,100}$/.test(code))
      throw new Error("Invalid readiness blocker");
    this.transaction(() => {
      const job = this.job(id);
      if (!job || job.stage !== "ready" || job.leaseOwner || job.activeTurnId)
        throw new Error("Readiness revocation requires an idle ready job");
      this.run(
        "UPDATE jobs SET stage='blocked',block_code=?,updated_at=? WHERE id=?",
        code,
        this.now(),
        id,
      );
      this.event(id, "readiness-revoked", { code });
    });
  }
  finishCodeReview(lease: Lease, retainLease = false): void {
    this.transaction(() => {
      const job = this.assertWorker(lease);
      if (
        job.stage !== "code-review" ||
        job.activeTurnId ||
        this.hasPending(job.id)
      )
        throw new Error(
          "Active review or pending work requires reconciliation",
        );
      const reviews = new Reviews(this),
        target = reviews.current(job.id);
      if (!target)
        throw new Error("Current-head code-review sign-off is required");
      reviews.requireCodeSignoff(job.id, target);
      this.run(
        "UPDATE jobs SET stage='e2e-review',lease_owner=?,lease_until=?,updated_at=? WHERE id=?",
        retainLease ? job.leaseOwner : null,
        retainLease ? job.leaseUntil : null,
        this.now(),
        job.id,
      );
      this.event(job.id, "code-review-completed", {
        head: target.head,
        base: target.base,
      });
    });
  }
  finishImplementation(lease: Lease, number: number): void {
    if (!Number.isSafeInteger(number) || number < 1)
      throw new Error("Invalid PR identity");
    this.transaction(() => {
      const j = this.assertWorker(lease);
      if (j.stage !== "verifying" || j.activeTurnId || this.hasPending(j.id))
        throw new Error("Implementation still needs reconciliation");
      if (j.prNumber !== null && j.prNumber !== number)
        throw new Error("PR identity changed");
      this.run(
        "UPDATE jobs SET stage='pr-open',pr_number=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE id=?",
        number,
        this.now(),
        j.id,
      );
      this.event(j.id, "implementation-pr-open", { number });
    });
  }
  /** Record an already accepted remote turn even if cancellation raced its response. */
  recordObservedTurn(lease: Lease, threadId: string, turnId: string): void {
    required(threadId);
    required(turnId);
    this.transaction(() => {
      const j = this.assertLease(lease);
      if (j.activeTurnId === turnId && j.activeThreadId === threadId) return;
      if (this.one("SELECT id FROM jobs WHERE active_turn_id IS NOT NULL"))
        throw new Error("There is already an active turn");
      this.run(
        "UPDATE jobs SET active_thread_id=?,active_turn_id=?,updated_at=? WHERE id=?",
        threadId,
        turnId,
        this.now(),
        j.id,
      );
      this.event(j.id, "observed-turn-recorded", { threadId, turnId });
    });
  }
  finishTurn(lease: Lease, turnId: string): void {
    this.transaction(() => {
      const j = this.assertLease(lease);
      if (j.activeTurnId !== turnId)
        throw new Error("Active turn identity mismatch");
      this.run(
        "UPDATE jobs SET active_turn_id=NULL,updated_at=? WHERE id=?",
        this.now(),
        j.id,
      );
      this.event(j.id, "turn-finished", { turnId });
    });
  }
  blockAndRelease(lease: Lease, code: string): void {
    required(code);
    this.transaction(() => {
      const j = this.assertLease(lease);
      if (j.activeTurnId) throw new Error("Cannot release an active turn");
      this.run(
        "UPDATE jobs SET stage='blocked',block_code=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE id=?",
        code,
        this.now(),
        j.id,
      );
      this.event(j.id, "blocked", { code });
    });
  }
  cancel(id: string, why: string): void {
    reason(why);
    this.transaction(() => {
      const j = this.job(id);
      if (!j) throw new Error("Unknown job");
      if (terminal.has(j.stage)) return;
      const uncertain = j.leaseOwner || j.activeTurnId || this.hasPending(id);
      this.run(
        "UPDATE jobs SET cancel_requested=1,stage=?,updated_at=? WHERE id=?",
        uncertain ? j.stage : "cancelled",
        this.now(),
        id,
      );
      this.event(id, "operator-cancel", {
        reason: why,
        pending: Boolean(uncertain),
      });
    });
  }
  retryBlocked(id: string, why: string): void {
    reason(why);
    this.transaction(() => {
      const j = this.job(id);
      if (!j || j.stage !== "blocked")
        throw new Error("Only blocked jobs can be retried");
      if (
        this.one("SELECT intake_invalid FROM jobs WHERE id=?", id)
          ?.intake_invalid
      )
        throw new Error("Intake contract needs reconciliation before retry");
      if (
        [
          "contract-changed",
          "requirements-missing",
          "ack-pending",
          "ack-uncertain",
        ].includes(j.blockCode ?? "")
      )
        throw new Error(
          "Intake contract or acknowledgment needs reconciliation before retry",
        );
      if (
        j.leaseOwner ||
        j.activeTurnId ||
        j.cancelRequested ||
        this.hasPending(id)
      )
        throw new Error("Job needs reconciliation before retry");
      this.run(
        "UPDATE jobs SET stage='queued',block_code=NULL,updated_at=? WHERE id=?",
        this.now(),
        id,
      );
      this.event(id, "operator-retry", { reason: why });
    });
  }
  operation(
    lease: Lease,
    key: string,
    kind: string,
    input: unknown,
  ): Operation {
    required(key);
    required(kind);
    return this.transaction(() => {
      this.assertWorker(lease);
      const prior = this.operations(lease.jobId).find((o) => o.key === key);
      if (prior) {
        if (prior.kind !== kind || json(prior.input) !== json(input))
          throw new Error("Operation intent mismatch");
        return prior;
      }
      this.run(
        "INSERT INTO operations VALUES (?,?,?,?, 'pending',NULL,?,?)",
        lease.jobId,
        key,
        kind,
        json(input),
        this.now(),
        this.now(),
      );
      this.event(lease.jobId, "operation-intent", { key, kind });
      return { key, kind, input, status: "pending", result: null };
    });
  }
  operations(id: string): Operation[] {
    return this.all(
      "SELECT * FROM operations WHERE job_id=? ORDER BY rowid",
      id,
    ).map((r) => ({
      key: String(r.key),
      kind: String(r.kind),
      input: JSON.parse(String(r.input)),
      status: r.status as "pending" | "done",
      result: r.result === null ? null : JSON.parse(String(r.result)),
    }));
  }
  completeOperation(lease: Lease, key: string, result: unknown): void {
    this.transaction(() => {
      this.assertLease(lease);
      const prior = this.operations(lease.jobId).find((o) => o.key === key);
      if (!prior) throw new Error("Missing operation intent");
      if (prior.status === "done") {
        if (json(prior.result) !== json(result))
          throw new Error("Operation result mismatch");
        return;
      }
      this.run(
        "UPDATE operations SET status='done',result=?,updated_at=? WHERE job_id=? AND key=?",
        json(result),
        this.now(),
        lease.jobId,
        key,
      );
      this.event(lease.jobId, "operation-result", { key });
    });
  }
  events(id: string): { kind: string; detail: unknown; at: number }[] {
    return this.all("SELECT * FROM events WHERE job_id=? ORDER BY id", id).map(
      (r) => ({
        kind: String(r.kind),
        detail: JSON.parse(String(r.detail)),
        at: Number(r.at),
      }),
    );
  }
  assertWorker(lease: Lease): Job {
    const j = this.assertLease(lease);
    if (j.cancelRequested) throw new Error("Cancellation requested");
    if (
      this.one("SELECT intake_invalid FROM jobs WHERE id=?", j.id)
        ?.intake_invalid
    )
      throw new Error("Intake contract needs reconciliation");
    const project = this.one(
      "SELECT enabled,configured,block_code FROM projects WHERE id=?",
      j.projectId,
    );
    if (!project?.enabled || !project.configured || project.block_code)
      throw new Error(
        "Project is unavailable; reconcile authorization before work",
      );
    return j;
  }
  hasExecutionReservation(): boolean {
    return (
      Boolean(
        this.one(
          "SELECT id FROM jobs WHERE lease_owner IS NOT NULL OR active_turn_id IS NOT NULL",
        ),
      ) || this.hasPending()
    );
  }
  private hasPending(id?: string): boolean {
    const where = id === undefined ? "" : " AND job_id=?";
    const args = id === undefined ? [] : [id];
    return Boolean(
      this.one(
        "SELECT key FROM operations WHERE status='pending'" + where,
        ...args,
      ) ||
        this.one(
          "SELECT id FROM outbox WHERE status='pending'" + where,
          ...args,
        ),
    );
  }
  private assertReconciled(j: Job): void {
    if (j.activeTurnId || this.hasPending(j.id))
      throw new Error("Remote activity needs reconciliation");
  }
  scheduleRetry(lease: Lease, at: number): void {
    if (!Number.isSafeInteger(at) || at < this.now())
      throw new Error("Invalid retry deadline");
    this.transaction(() => {
      const j = this.assertWorker(lease);
      this.assertReconciled(j);
      this.run(
        "UPDATE jobs SET resume_stage=stage,stage='waiting',retry_at=?,lease_owner=NULL,lease_until=NULL,updated_at=? WHERE id=?",
        at,
        this.now(),
        j.id,
      );
      this.event(j.id, "retry-scheduled", { at });
    });
  }
  completeCancellation(lease: Lease): void {
    this.transaction(() => {
      const j = this.assertLease(lease);
      if (!j.cancelRequested) throw new Error("Cancellation not requested");
      this.assertReconciled(j);
      this.run(
        "UPDATE jobs SET stage='cancelled',lease_owner=NULL,lease_until=NULL,updated_at=? WHERE id=?",
        this.now(),
        j.id,
      );
      this.event(j.id, "cancelled", {});
    });
  }
  budgetUsed(id: string, name: string): number {
    return Number(
      this.one("SELECT used FROM budgets WHERE job_id=? AND name=?", id, name)
        ?.used ?? 0,
    );
  }
  consumeBudget(lease: Lease, name: string, limit: number): number {
    required(name);
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new Error("Invalid budget limit");
    return this.transaction(() => {
      this.assertWorker(lease);
      const used = Number(
        this.one(
          "SELECT used FROM budgets WHERE job_id=? AND name=?",
          lease.jobId,
          name,
        )?.used ?? 0,
      );
      if (used >= limit) throw new Error("Execution budget exhausted");
      this.run(
        "INSERT INTO budgets VALUES (?,?,?) ON CONFLICT(job_id,name) DO UPDATE SET used=excluded.used",
        lease.jobId,
        name,
        used + 1,
      );
      this.event(lease.jobId, "budget-consumed", { name, used: used + 1 });
      return used + 1;
    });
  }
  notification(
    lease: Lease,
    kind: string,
    payload: unknown,
  ): { id: string; status: string } {
    required(kind);
    return this.transaction(() => {
      this.assertWorker(lease);
      const prior = this.one(
        "SELECT * FROM outbox WHERE job_id=? AND kind=?",
        lease.jobId,
        kind,
      );
      if (prior) {
        if (prior.payload !== json(payload))
          throw new Error("Notification intent mismatch");
        return { id: String(prior.id), status: String(prior.status) };
      }
      const id = randomUUID();
      this.run(
        "INSERT INTO outbox VALUES (?,?,?,?,'pending',NULL,?)",
        id,
        lease.jobId,
        kind,
        json(payload),
        this.now(),
      );
      this.event(lease.jobId, "notification-intent", { id, kind });
      return { id, status: "pending" };
    });
  }
  notifications(id: string): {
    id: string;
    kind: string;
    payload: unknown;
    status: string;
    remoteId: string | null;
  }[] {
    return this.all(
      "SELECT * FROM outbox WHERE job_id=? ORDER BY created_at,id",
      id,
    ).map((r) => ({
      id: String(r.id),
      kind: String(r.kind),
      payload: JSON.parse(String(r.payload)),
      status: String(r.status),
      remoteId: r.remote_id as string | null,
    }));
  }
  acknowledgeNotification(lease: Lease, id: string, remoteId: string): void {
    required(remoteId);
    this.transaction(() => {
      this.assertLease(lease);
      const prior = this.one(
        "SELECT * FROM outbox WHERE id=? AND job_id=?",
        id,
        lease.jobId,
      );
      if (!prior || (prior.remote_id !== null && prior.remote_id !== remoteId))
        throw new Error("Conflicting notification acknowledgment");
      this.run(
        "UPDATE outbox SET status='done',remote_id=? WHERE id=?",
        remoteId,
        id,
      );
    });
  }
  view(): { projects: ProjectRecord[]; jobs: Job[]; intakePaused: boolean } {
    this.db.exec("BEGIN");
    try {
      const view = {
        projects: this.projects(),
        jobs: this.jobs(),
        intakePaused: this.paused(),
      };
      this.db.exec("COMMIT");
      return view;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
