import type { Store } from "./store.js";
export interface CycleServices {
  preflight(): Promise<void>;
  recover(): Promise<string>;
  recheck(id: string): Promise<void>;
  poll(): Promise<void>;
  review(id: string, role: "code-review" | "e2e-review"): Promise<string>;
  implement(): Promise<string>;
}
/** One stage per cycle, with fresh dependency checks and ownership reconciliation. */
export async function workerCycle(
  store: Pick<Store, "jobs" | "paused">,
  services: CycleServices,
): Promise<string> {
  await services.preflight();
  const recovery = await services.recover();
  if (recovery !== "clear") return recovery;
  for (const job of store.jobs())
    if (job.stage === "ready") await services.recheck(job.id);
  if (store.paused()) return "paused";
  const next = store
    .jobs()
    .find(
      (job) =>
        !job.cancelRequested && ["pr-open", "e2e-review"].includes(job.stage),
    );
  if (next)
    return services.review(
      next.id,
      next.stage === "pr-open" ? "code-review" : "e2e-review",
    );
  await services.poll();
  return services.implement();
}
