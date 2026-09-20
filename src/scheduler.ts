import type { Store, Lease } from "./store.js";
export interface WorkContext {
  lease: Lease;
  signal: AbortSignal;
  assertActive(): void;
}
/** One claimed job at a time; external adapters must honor abort and assertActive. */
export class Scheduler {
  constructor(
    private readonly store: Store,
    private readonly owner: string,
    private readonly leaseMs = 30000,
  ) {
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 30)
      throw new Error("Lease must be at least 30 milliseconds");
  }
  async runOnce(
    handler: (context: WorkContext) => Promise<void>,
  ): Promise<string> {
    const lease = this.store.claim(this.owner, this.leaseMs);
    if (!lease) return "idle";
    const abort = new AbortController();
    const context: WorkContext = {
      lease,
      signal: abort.signal,
      assertActive: () => {
        if (abort.signal.aborted)
          throw new Error("Lease lost or cancellation requested");
        this.store.assertWorker(lease);
      },
    };
    const timer = setInterval(
      () => {
        try {
          this.store.assertWorker(lease);
          this.store.heartbeat(lease, this.leaseMs);
        } catch {
          abort.abort();
        }
      },
      Math.max(10, Math.floor(this.leaseMs / 3)),
    );
    try {
      await handler(context);
    } catch {
      // Failure details can contain secrets; persist only a stable safe blocker.
    } finally {
      clearInterval(timer);
    }
    const job = this.store.job(lease.jobId);
    if (!job) return "lease-lost";
    if (!job.leaseOwner) return job.stage;
    try {
      if (job.cancelRequested) {
        this.store.completeCancellation(lease);
        return "cancelled";
      }
      this.store.blockAndRelease(lease, "external-state-unknown");
      return "blocked";
    } catch {
      // A live/uncertain remote turn or lost lease keeps ownership reserved.
      return "reconciliation-required";
    }
  }
}
