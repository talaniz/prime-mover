import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { validateConfig } from "../dist/config.js";
import { serviceLoop } from "../dist/service-loop.js";

process.umask(0o077);
const [configPath, finiteCycles, ...extra] = process.argv.slice(2);
const stop = new AbortController();
let child, killTimer;
const shutdown = () => {
  stop.abort();
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    killTimer ??= setTimeout(() => {
      // A forced exit does not imply a remote turn stopped. Its ledger reservation
      // survives and must be reconciled by the next cycle.
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }, 45000);
  }
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
try {
  if (
    !configPath ||
    extra.length ||
    (finiteCycles !== undefined && !/^[1-9][0-9]*$/.test(finiteCycles))
  )
    throw Error("Usage: worker-service.mjs CONFIG [FINITE_CYCLES]");
  const path = resolve(configPath);
  const config = validateConfig(JSON.parse(await readFile(path, "utf8")));
  const result = await serviceLoop(
    () =>
      new Promise((resolveCycle) => {
        if (stop.signal.aborted) return resolveCycle(true);
        child = spawn(
          process.execPath,
          [
            fileURLToPath(new URL("../dist/cli.js", import.meta.url)),
            "cycle",
            path,
          ],
          {
            detached: true,
            stdio: ["ignore", "inherit", "inherit"],
          },
        );
        child.once("error", () => resolveCycle(false));
        child.once("close", (code) => {
          clearTimeout(killTimer);
          killTimer = undefined;
          child = undefined;
          resolveCycle(code === 0);
        });
      }),
    {
      intervalMs: config.pollSeconds * 1000,
      maxConsecutiveFailures: config.limits.transportAttempts,
      ...(finiteCycles === undefined
        ? {}
        : { maxCycles: Number(finiteCycles) }),
      signal: stop.signal,
    },
  );
  console.log(
    JSON.stringify({
      service: result.stopped ? "stopped" : "completed",
      cycles: result.cycles,
    }),
  );
} catch {
  console.error(
    "Prime Mover service stopped: configuration or cycle failure; inspect redacted cycle results.",
  );
  process.exitCode = 1;
} finally {
  clearTimeout(killTimer);
  process.removeListener("SIGTERM", shutdown);
  process.removeListener("SIGINT", shutdown);
}
