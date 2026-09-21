import { readinessEvidence } from "./readiness.js";
import type { WorkspacePlan } from "./worktree.js";
import { ReviewCoordinator } from "./review-coordinator.js";
import { ReviewInputs } from "./review-input.js";
import { PrComments } from "./pr-comments.js";
import { randomUUID } from "node:crypto";
import { Implementation } from "./implementation.js";
import { Worktrees } from "./worktree.js";
import { ExecutionAgent } from "./execution-agent.js";
import { Publication, GitHubPulls } from "./publication.js";
import { Scheduler } from "./scheduler.js";
import { readFile, lstat, chmod } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { validateConfig, PROTOCOL_VERSION } from "./config.js";
import { checkStorage, openRuntime } from "./storage.js";
import { metadataServer, metadataSnapshot } from "./metadata.js";
import { Intake } from "./intake.js";
import { GitHubClient } from "./github.js";
import { AppServer } from "./app-server.js";
import type { Job, Store } from "./store.js";

const [command, configPath, ...args] = process.argv.slice(2);
const commands = [
  "config-check",
  "doctor",
  "status",
  "inspect",
  "pause",
  "resume",
  "cancel",
  "retry",
  "metadata",
  "poll",
  "run-once",
  "code-review",
  "e2e-review",
  "recheck-ready",
  "resume-code-review",
  "resume-publication",
  "reconcile-issue",
  "rerun",
];
function output(value: unknown): void {
  console.log(JSON.stringify(value));
}
function publicJob(job: Job | null): unknown {
  if (!job) throw new Error("Unknown job");
  return {
    id: job.id,
    projectId: job.projectId,
    issue: job.issue,
    stage: job.stage,
    attempts: job.attempts,
    cancelRequested: job.cancelRequested,
    leaseHeld: job.leaseOwner !== null,
    activeTurn: job.activeTurnId !== null,
  };
}
async function tokenFrom(filename: string): Promise<string> {
  const stat = await lstat(filename);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    stat.uid !== process.getuid?.()
  )
    throw new Error("Metadata credential file must be owner-only mode 0600");
  const token = (await readFile(filename, "utf8")).trim();
  if (token.length < 32 || /\s/.test(token))
    throw new Error("Metadata credential token is missing or invalid");
  return token;
}
process.umask(0o077);
if (!command || !commands.includes(command) || !configPath) {
  console.error(
    "Usage: node dist/cli.js COMMAND CONFIG_PATH [JOB_ID REASON]; commands: " +
      commands.join(", "),
  );
  process.exitCode = 2;
} else {
  let store: Store | undefined;
  let keepOpen = false;
  try {
    let input: unknown;
    try {
      input = JSON.parse(await readFile(configPath, "utf8"));
    } catch {
      throw new Error(
        "Invalid configuration: file is missing, unreadable or invalid JSON",
      );
    }
    const config = validateConfig(input);
    if (command === "config-check") {
      if (args.length) throw new Error("Unexpected command arguments");
      output({
        valid: true,
        projects: config.projects.map((p) => p.id),
        executionStarted: false,
      });
    } else if (command === "doctor") {
      checkStorage(config);
      if (
        config.appServer.version !== PROTOCOL_VERSION ||
        execFileSync("codex", ["--version"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim() !== `codex-cli ${PROTOCOL_VERSION}`
      )
        throw new Error(
          "Unsupported app-server protocol version; repeat compatibility acceptance",
        );
      await tokenFrom(config.metadata.tokenFile);
      // Read-only authentication probes; never start a task or create runtime state.
      execFileSync("gh", ["api", "user", "--jq", ".login"], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const p of config.projects.filter((p) => p.enabled))
        execFileSync("gh", ["api", `repos/${p.repository}`], {
          stdio: ["ignore", "pipe", "ignore"],
        });
      const client = new AppServer(config.appServer.socket);
      try {
        await client.connect();
        await client.request("thread/loaded/list", {});
      } finally {
        client.close();
      }
      output({
        ok: true,
        storage: "verified",
        credentials: "available",
        protocol: PROTOCOL_VERSION,
        executionStarted: false,
      });
    } else {
      store = openRuntime(config);
      if (command === "status")
        output(metadataSnapshot(store, config.metadata.freshnessSeconds));
      else if (command === "inspect")
        output(publicJob(store.job(args[0] ?? "")));
      else if (command === "pause" || command === "resume") {
        store.setPaused(command === "pause");
        output({ intakePaused: store.paused() });
      } else if (command === "cancel" || command === "retry") {
        const [id, ...words] = args;
        const why = words.join(" ");
        if (!id || !why)
          throw new Error("Job ID and explicit reason are required");
        if (command === "cancel") store.cancel(id, why);
        else store.retryBlocked(id, why);
        output(publicJob(store.job(id)));
      } else if (command === "recheck-ready") {
        if (args.length !== 1)
          throw new Error("Exactly one ready job ID is required");
        const id = args[0]!,
          job = store.job(id);
        if (!job || job.stage !== "ready") throw new Error("Job is not ready");
        try {
          const intake = new Intake(store, new GitHubClient());
          await intake.authorize(id);
          const project = store.projects().find((p) => p.id === job.projectId)!;
          const plan = store
            .operations(id)
            .find((o) => o.key === "workspace-plan")!.result as WorkspacePlan;
          const pulls = new GitHubPulls(),
            inputs = new ReviewInputs(
              new Worktrees(config.storage.root, undefined, config.gitAuthor),
              pulls,
            );
          const input = await inputs.collect(plan, project, job.prNumber!);
          readinessEvidence(
            store,
            id,
            await pulls.readiness(
              project.repository,
              job.prNumber!,
              project.baseBranch,
              input.target,
            ),
            Date.now(),
            true,
          );
          output({ result: "ready", head: input.target.head });
        } catch {
          if (store.job(id)?.stage === "ready")
            store.revokeReadiness(id, "readiness-check-failed");
          output({ result: store.job(id)?.stage ?? "blocked" });
          process.exitCode = 1;
        }
      } else if (
        [
          "run-once",
          "resume-publication",
          "code-review",
          "e2e-review",
          "resume-code-review",
        ].includes(command)
      ) {
        if (!config.gitAuthor)
          throw new Error(
            "Configure gitAuthor.name and gitAuthor.email before execution",
          );
        if (command === "resume-code-review" && args.length < 2)
          throw new Error("Job ID and explicit reason are required");
        if (
          ["code-review", "e2e-review"].includes(command) &&
          args.length !== 1
        )
          throw new Error("Exactly one job ID is required for code review");
        if (command === "run-once" && args.length)
          throw new Error("Unexpected command arguments");
        if (command === "resume-publication" && args.length < 2)
          throw new Error("Job ID and explicit reason are required");
        if (
          config.appServer.version !== PROTOCOL_VERSION ||
          execFileSync("codex", ["--version"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim() !== `codex-cli ${PROTOCOL_VERSION}`
        )
          throw new Error(
            "Unsupported app-server protocol version; repeat compatibility acceptance",
          );
        const app = new AppServer(config.appServer.socket, 30000);
        let agent: ExecutionAgent | undefined;
        try {
          await app.connect();
          agent = new ExecutionAgent(store, app);
          const github = new GitHubClient();
          const intake = new Intake(store, github, {
            pollMs: config.pollSeconds * 1000,
            interrupt: async (threadId, turnId) => {
              await app.request("turn/interrupt", { threadId, turnId });
            },
          });
          const trees = new Worktrees(
            config.storage.root,
            undefined,
            config.gitAuthor,
          );
          const pulls = new GitHubPulls();
          const publication = new Publication(
            store,
            trees,
            pulls,
            undefined,
            (id) => intake.authorize(id),
          );
          const worker = new Implementation(
            store,
            config,
            intake,
            trees,
            agent,
            publication,
          );
          const owner = `worker-${randomUUID()}`;
          const scheduler = new Scheduler(store, owner);
          let result: string;
          if (
            ["code-review", "resume-code-review", "e2e-review"].includes(
              command,
            )
          ) {
            const e2e = command === "e2e-review";
            const id = args[0]!;
            let lease;
            if (command === "resume-code-review") {
              const last = store
                .operations(id)
                .filter((o) => o.kind === "turn-start")
                .at(-1);
              if (
                !last ||
                last.status !== "done" ||
                !last.key.endsWith(":turn")
              )
                throw new Error("Review task requires reconciliation");
              const proof = await agent.proveCompleted(
                id,
                last.key.slice(0, -":turn".length),
              );
              await intake.authorize(id, { allowOperationalBlock: true });
              lease = store.reclaimCodeReview(
                id,
                owner,
                30000,
                args.slice(1).join(" "),
                proof,
              );
            } else {
              await intake.authorize(id);
              lease = e2e
                ? store.claimE2EReview(id, owner, 30000)
                : store.claimCodeReview(id, owner, 30000);
            }
            const inputs = new ReviewInputs(trees, pulls),
              comments = new PrComments(store, github, (id) =>
                intake.authorize(id),
              );
            const review = new ReviewCoordinator(
              store,
              config,
              { agent, inputs, comments, publication, intake },
              { role: e2e ? "e2e-review" : "code-review" },
            );
            result = await scheduler.runClaimed(lease, async (context) => {
              await review.run(context);
              if (e2e) {
                const job = store!.job(id)!,
                  project = store!
                    .projects()
                    .find((p) => p.id === job.projectId)!;
                const plan = store!
                  .operations(id)
                  .find((o) => o.key === "workspace-plan")!
                  .result as WorkspacePlan;
                const refresh = async () => {
                  context.assertActive();
                  await intake.authorize(id);
                  const input = await inputs.collect(
                    plan,
                    project,
                    job.prNumber!,
                  );
                  const remote = await pulls.readiness(
                    project.repository,
                    job.prNumber!,
                    project.baseBranch,
                    input.target,
                  );
                  context.assertActive();
                  return remote;
                };
                try {
                  await comments.ready(context, await refresh());
                  store!.finishReady(context.lease, await refresh());
                } catch (error) {
                  store!.blockAndRelease(
                    context.lease,
                    "readiness-check-failed",
                  );
                  throw error;
                }
              }
            });
          } else if (command === "resume-publication") {
            const id = args[0]!;
            const proof = await agent.proveCompleted(id);
            await intake.authorize(id, { allowOperationalBlock: true });
            const lease = store.reclaimPublication(
              id,
              owner,
              30000,
              args.slice(1).join(" "),
              proof,
            );
            result = await scheduler.runClaimed(lease, (context) =>
              worker.run(context),
            );
          } else
            result = await scheduler.runOnce((context) => worker.run(context));
          output({ result });
          if (!["idle", "pr-open", "e2e-review", "ready"].includes(result))
            process.exitCode = 1;
        } finally {
          agent?.close();
          app.close();
        }
      } else if (["poll", "reconcile-issue", "rerun"].includes(command)) {
        const app = new AppServer(config.appServer.socket);
        let connected = false;
        const intake = new Intake(store, new GitHubClient(), {
          pollMs: config.pollSeconds * 1000,
          interrupt: async (threadId, turnId) => {
            if (!connected) {
              await app.connect();
              connected = true;
            }
            await app.request("turn/interrupt", { threadId, turnId });
          },
        });
        try {
          if (command === "poll") {
            if (args.length) throw new Error("Unexpected command arguments");
            await intake.poll();
            output(metadataSnapshot(store, config.metadata.freshnessSeconds));
          } else {
            const [id, ...words] = args;
            if (!id || !words.length)
              throw new Error("Job ID and explicit reason are required");
            if (command === "reconcile-issue") {
              await intake.reconcile(id, words.join(" "));
              output(publicJob(store.job(id)));
            } else
              output(
                publicJob(store.job(await intake.rerun(id, words.join(" ")))),
              );
          }
        } finally {
          app.close();
        }
      } else if (command === "metadata") {
        const token = await tokenFrom(config.metadata.tokenFile);
        const server = metadataServer(
          store,
          token,
          config.metadata.freshnessSeconds,
        );
        await new Promise<void>((resolve, reject) => {
          server.once("error", reject);
          server.listen(config.metadata.socket, resolve);
        });
        await chmod(config.metadata.socket, 0o600);
        keepOpen = true;
        const stop = () => {
          server.close(() => {
            store?.close();
            process.exitCode = 0;
          });
        };
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        output({ metadata: "listening", executionStarted: false });
      }
    }
  } catch (error) {
    // Child-process diagnostics may contain credentials. Reflect only our own errors.
    const message =
      error instanceof Error && !("status" in error) && !("code" in error)
        ? error.message
        : "Operation failed: verify storage, credentials, socket and configuration";
    console.error(message);
    process.exitCode = 1;
  } finally {
    if (!keepOpen) store?.close();
  }
}
