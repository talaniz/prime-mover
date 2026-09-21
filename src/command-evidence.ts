import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Store } from "./store.js";
import type { Config } from "./config.js";
import type { WorkContext } from "./scheduler.js";
import type { IntakeSnapshot } from "./intake.js";
import type { WorkspacePlan } from "./worktree.js";
import { ExecutionBlocked } from "./execution-agent.js";
import { runIsolated, type CommandResult } from "./verification.js";
import { safeDescendant } from "./storage.js";
function data(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ExecutionBlocked("invalid-execution-record");
  return value as Record<string, unknown>;
}
export class CommandEvidence {
  constructor(
    private readonly store: Store,
    private readonly config: Config,
    private readonly intake: { authorize(id: string): Promise<IntakeSnapshot> },
  ) {}
  async run(
    context: WorkContext,
    plan: WorkspacePlan,
    argv: string[],
    key: string,
    kind: "setup" | "verification",
    deadline: number,
  ): Promise<{ result: CommandResult; artifact: string }> {
    context.assertActive();
    await this.intake.authorize(context.lease.jobId);
    const previous = this.store
      .operations(context.lease.jobId)
      .find((o) => o.key === key);
    const input = { cwd: plan.cwd, argv, deadline, network: kind === "setup" };
    const op = this.store.operation(context.lease, key, kind, input);
    const dir = path.join(
      this.config.storage.root,
      "artifacts",
      context.lease.jobId,
    );
    safeDescendant(this.config.storage.root, dir);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const artifact = path.join(dir, `${key.replaceAll(":", "-")}.json`);
    safeDescendant(this.config.storage.root, artifact);
    if (op.status === "done")
      return data(op.result) as unknown as {
        result: CommandResult;
        artifact: string;
      };
    let result: CommandResult;
    if (previous) {
      let saved: Record<string, unknown>;
      try {
        saved = data(JSON.parse(await readFile(artifact, "utf8")));
      } catch {
        throw new ExecutionBlocked("command-result-uncertain");
      }
      if (
        saved.jobId !== context.lease.jobId ||
        saved.key !== key ||
        JSON.stringify(saved.input) !== JSON.stringify(input)
      )
        throw new ExecutionBlocked("command-evidence-mismatch");
      result = data(saved.result) as unknown as CommandResult;
    } else {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new ExecutionBlocked("budget-exhausted");
      context.assertActive();
      result = await runIsolated(plan.cwd, argv, {
        timeoutMs: remaining,
        signal: context.signal,
        network: kind === "setup",
        gitCommonDir: plan.bare,
      });
      await writeFile(
        artifact,
        JSON.stringify({ jobId: context.lease.jobId, key, input, result }),
        { mode: 0o600, flag: "wx" },
      );
    }
    const record = { result, artifact };
    this.store.completeOperation(context.lease, key, record);
    return record;
  }
}
