import type { Store } from "./store.js";
import type { Config } from "./config.js";
import type { WorkContext } from "./scheduler.js";
import {
  ExecutionBlocked,
  type ExecutionAgent,
  type AgentRun,
} from "./execution-agent.js";
export async function waitForAgent(
  {
    store,
    config,
    intake,
    agent,
    options = {},
  }: {
    store: Store;
    config: Config;
    intake: { authorize(id: string): Promise<unknown> };
    agent: Pick<ExecutionAgent, "observe">;
    options?: { pollMs?: number; approvalWaitMs?: number };
  },
  context: WorkContext,
  run: AgentRun,
  deadline: number,
): Promise<void> {
  const stop = new AbortController();
  const stopKey = `${run.key}:stop`;
  if (store.operations(context.lease.jobId).some((o) => o.key === stopKey))
    stop.abort();
  let nextAuthorization = Date.now() + config.pollSeconds * 1000;
  let waitingSince: number | undefined, stopSince: number | undefined;
  for (;;) {
    try {
      context.assertActive();
      if (Date.now() >= nextAuthorization) {
        await intake.authorize(context.lease.jobId);
        nextAuthorization = Date.now() + config.pollSeconds * 1000;
      }
    } catch {
      stop.abort();
    }
    if (Date.now() >= deadline || context.signal.aborted) stop.abort();
    const status = await agent.observe(
      {
        ...context,
        signal: stop.signal.aborted ? stop.signal : context.signal,
      },
      run,
    );
    if (status === "completed") {
      if (stop.signal.aborted)
        throw new ExecutionBlocked("review-authorization-or-budget-changed");
      if (store.job(context.lease.jobId)!.stage === "waiting")
        store.resumeCompletedApproval(context.lease);
      break;
    }
    if (status === "failed" || status === "interrupted")
      throw new ExecutionBlocked("review-turn-failed");
    if (status === "timed-out") {
      stop.abort();
      store.operation(context.lease, stopKey, "review-stop", {
        reason: "turn-timeout",
      });
      store.completeOperation(context.lease, stopKey, {
        requested: true,
      });
    }
    if (status === "timed-out" || stop.signal.aborted) {
      stopSince ??= Date.now();
      if (Date.now() - stopSince >= 10000)
        throw new ExecutionBlocked("review-turn-stop-uncertain");
    } else if (status === "waiting") {
      store.setApprovalWait(context.lease, true);
      waitingSince ??= Date.now();
      if (Date.now() - waitingSince >= (options.approvalWaitMs ?? 30000))
        throw new ExecutionBlocked("approval-required");
    } else {
      waitingSince = undefined;
      if (store.job(context.lease.jobId)!.stage === "waiting")
        store.setApprovalWait(context.lease, false);
    }
    await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 1000));
  }
}
