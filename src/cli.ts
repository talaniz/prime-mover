import { readFile, lstat, chmod } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { validateConfig, PROTOCOL_VERSION } from "./config.js";
import { checkStorage, openRuntime } from "./storage.js";
import { metadataServer, metadataSnapshot } from "./metadata.js";
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
