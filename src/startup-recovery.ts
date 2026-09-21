import { randomUUID } from "node:crypto";
import type { Store, Job, Operation, RecoveryStage } from "./store.js";
import { Scheduler, type WorkContext } from "./scheduler.js";
import type { ExecutionAgent } from "./execution-agent.js";

/** Reconcile ownership before a caller polls intake or starts any new job.
 * Continuations must select their workflow stage through Store.resumeRecovery.
 */
export class StartupRecovery {
  constructor(
    private readonly store: Store,
    private readonly options: {
      jobSeconds: number;
      recoveryAttempts: number;
      leaseMs?: number;
      stopWaitMs?: number;
      pollMs?: number;
      now?: () => number;
      signal?: AbortSignal;
      canContinue?: () => void;
    },
    private readonly agent: Pick<
      ExecutionAgent,
      "reconcileRecorded" | "observe"
    >,
    private readonly intake: {
      authorize(
        id: string,
        options: { allowOperationalBlock: boolean },
      ): Promise<unknown>;
    },
  ) {
    for (const value of [
      options.jobSeconds,
      options.recoveryAttempts,
      options.leaseMs ?? 30000,
      options.stopWaitMs ?? 10000,
      options.pollMs ?? 250,
    ])
      if (!Number.isSafeInteger(value) || value < 1)
        throw new Error("Invalid startup recovery limits");
  }
  async run(
    continueRecorded: (context: WorkContext) => Promise<void>,
  ): Promise<string> {
    const now = this.options.now ?? Date.now;
    // Scan the entire ledger, including anomalous terminal records, before choosing
    // an owner. No early clear result may hide a later uncertain operation.
    const reserved = this.store
      .jobs()
      .filter(
        (job) =>
          job.leaseOwner ||
          job.activeTurnId ||
          this.store.operations(job.id).some((op) => op.status === "pending") ||
          this.store
            .notifications(job.id)
            .some((item) => item.status === "pending"),
      );
    if (!reserved.length) return "clear";
    if (
      reserved.some(
        (job) =>
          job.leaseOwner && (job.leaseUntil === null || job.leaseUntil > now()),
      )
    )
      return "busy";
    if (reserved.length !== 1) return "reconciliation-required";
    const job = reserved[0]!;
    if (
      [
        "queued",
        "discovered",
        "authorized",
        "ready",
        "cancelled",
        "merged",
        "closed",
      ].includes(job.stage)
    )
      return "reconciliation-required";
    const owner = `recovery-${randomUUID()}`,
      leaseMs = this.options.leaseMs ?? 30000;
    const lease = this.store.claimRecovery(job.id, owner, leaseMs);
    return new Scheduler(
      this.store,
      owner,
      leaseMs,
      this.options.signal,
    ).runClaimed(
      lease,
      async (context) => {
        let allowed = true;
        let blocker = "recovery-stopped";
        const deny = (code: string) => {
          allowed = false;
          blocker = code;
        };
        try {
          await this.intake.authorize(job.id, { allowOperationalBlock: true });
        } catch {
          deny("recovery-authorization-unavailable");
        }
        if (allowed) {
          try {
            this.store.recoverExecutionBudget(lease, this.options.jobSeconds);
          } catch {
            deny("recovery-budget-exhausted-or-invalid");
          }
        }
        if (allowed) {
          try {
            this.options.canContinue?.();
          } catch {
            deny("recovery-resource-unavailable");
          }
        }
        if (
          allowed &&
          this.store.budgetUsed(job.id, "recovery-attempts") >=
            this.options.recoveryAttempts
        )
          deny("recovery-attempt-budget-exhausted");
        if (
          allowed &&
          this.store.budgetUsed(job.id, "transport-failures") >=
            this.options.recoveryAttempts
        )
          deny("transport-budget-exhausted");
        const stop = new AbortController();
        if (!allowed) stop.abort();
        const observation: WorkContext = {
          ...context,
          signal: AbortSignal.any([context.signal, stop.signal]),
        };
        const operations = this.store.operations(job.id);
        const latest = operations
          .filter(
            (op) => op.kind === "thread-start" || op.kind === "turn-start",
          )
          .at(-1);
        if (!latest && this.store.job(job.id)!.activeTurnId)
          throw new Error("Missing recorded task identity");
        if (latest) {
          if (!/:(thread|turn)$/.test(latest.key))
            throw new Error("Invalid recorded task key");
          const key = latest.key.replace(/:(thread|turn)$/, "");
          if (
            operations.some(
              (op) =>
                op.status === "pending" &&
                ["thread-start", "turn-start"].includes(op.kind) &&
                op.key !== `${key}:thread` &&
                op.key !== `${key}:turn`,
            )
          )
            throw new Error(
              "Multiple uncertain task identities require reconciliation",
            );
          const run = await this.agent.reconcileRecorded(observation, key);
          if (run) {
            // Wall time bounds stopping even if the injected job clock is paused.
            const stopBy = Date.now() + (this.options.stopWaitMs ?? 10000);
            for (;;) {
              const state = await this.agent.observe(observation, run);
              if (state === "completed") break;
              if (["failed", "interrupted"].includes(state)) {
                if (allowed)
                  deny(
                    state === "failed"
                      ? "recovered-turn-failed"
                      : "recovered-turn-interrupted",
                  );
                break;
              }
              if (
                allowed &&
                !observation.signal.aborted &&
                state !== "timed-out"
              )
                break;
              allowed = false;
              stop.abort();
              if (Date.now() >= stopBy)
                throw new Error("Owned turn stop remains unconfirmed");
              await new Promise((resolve) =>
                setTimeout(resolve, this.options.pollMs ?? 250),
              );
            }
          }
        }
        if (!allowed || observation.signal.aborted) {
          if (!this.store.job(job.id)!.cancelRequested)
            this.store.blockAndRelease(lease, blocker);
          return;
        }
        context.assertActive();
        await continueRecorded(context);
      },
      { reconciliation: true },
    );
  }
}

/** Restore the interrupted coordinator without rebinding a pending correction's target. */
export function recoveryRoute(
  job: Pick<Job, "prNumber">,
  operations: Operation[],
): {
  stage: RecoveryStage;
  role: "implementation" | "code-review" | "e2e-review";
} {
  if (job.prNumber === null)
    return { stage: "preparing", role: "implementation" };
  const e2e = operations.some((op) => op.kind === "e2e-review-cycle");
  const pendingCycle = operations
    .filter(
      (op) =>
        ["review-cycle", "e2e-review-cycle"].includes(op.kind) &&
        op.status === "pending",
    )
    .at(-1);
  if (pendingCycle) {
    const role =
      pendingCycle.kind === "e2e-review-cycle" ? "e2e-review" : "code-review";
    const round = pendingCycle.key.split(":").at(-1);
    const fix = operations.find(
      (op) =>
        op.key ===
        `${role === "e2e-review" ? "e2e" : "code"}-fix-${round}:correction`,
    );
    if (fix)
      return {
        stage:
          fix.status === "done"
            ? "verifying"
            : role === "e2e-review"
              ? "e2e-fixes"
              : "code-fixes",
        role,
      };
    return { stage: role, role: e2e ? "e2e-review" : "code-review" };
  }
  if (!e2e) return { stage: "code-review", role: "code-review" };
  const fix = operations
    .filter((op) => op.kind === "review-fix" && op.status === "done")
    .at(-1);
  const report = operations
    .filter(
      (op) => /^code-review-[0-9]+:round$/.test(op.key) && op.status === "done",
    )
    .at(-1);
  const head = (fix?.result as { head?: unknown } | null)?.head;
  const signed = report?.result as { head?: unknown; verdict?: unknown } | null;
  return {
    stage:
      fix && (!head || signed?.verdict !== "sign-off" || signed.head !== head)
        ? "code-review"
        : "e2e-review",
    role: "e2e-review",
  };
}
