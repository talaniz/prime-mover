import { spawn } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
export interface CommandResult {
  exitCode: number | null;
  status: "passed" | "failed" | "timeout" | "cancelled" | "output-limit";
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
}
/** Configured commands run with no host home/credential mounts or inherited secrets. */
export async function runIsolated(
  cwd: string,
  argv: string[],
  options: {
    timeoutMs: number;
    signal?: AbortSignal;
    network?: boolean;
    gitCommonDir?: string;
  },
): Promise<CommandResult> {
  const startedAt = new Date().toISOString();
  const result = (
    status: CommandResult["status"],
    exitCode: number | null,
    stdout = "",
    stderr = "",
  ): CommandResult => ({
    status,
    exitCode,
    stdout,
    stderr,
    startedAt,
    completedAt: new Date().toISOString(),
  });
  if (
    !argv.length ||
    argv.some((a) => typeof a !== "string" || a.includes("\0")) ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1
  )
    throw new Error("Invalid verification command");
  if (options.signal?.aborted) return result("cancelled", null);
  if ((await realpath(cwd)) !== cwd || !(await lstat(cwd)).isDirectory())
    throw new Error("Verification requires a canonical worktree directory");
  const nodeRoot = path.dirname(path.dirname(await realpath(process.execPath)));
  const args = [
    "--die-with-parent",
    "--unshare-pid",
    "--unshare-ipc",
    "--unshare-uts",
    "--clearenv",
    "--ro-bind",
    "/usr",
    "/usr",
    "--symlink",
    "usr/bin",
    "/bin",
    "--symlink",
    "usr/lib",
    "/lib",
  ];
  if (existsSync("/lib64")) args.push("--ro-bind", "/lib64", "/lib64");
  args.push(
    "--ro-bind",
    nodeRoot,
    "/opt/node",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    "--dir",
    "/home/worker",
    "--dir",
    "/etc",
  );
  if (!options.network) args.push("--unshare-net");
  for (const file of [
    "/etc/ssl",
    "/etc/resolv.conf",
    "/etc/hosts",
    "/etc/nsswitch.conf",
  ])
    if (existsSync(file)) args.push("--ro-bind", file, file);
  if (options.gitCommonDir) {
    if ((await realpath(options.gitCommonDir)) !== options.gitCommonDir)
      throw new Error("Git evidence directory must be canonical");
    args.push("--ro-bind", options.gitCommonDir, options.gitCommonDir);
  }
  args.push(
    "--bind",
    cwd,
    cwd,
    "--chdir",
    cwd,
    "--setenv",
    "PATH",
    "/opt/node/bin:/usr/bin:/bin",
    "--setenv",
    "HOME",
    "/home/worker",
    "--setenv",
    "TMPDIR",
    "/tmp",
    "--setenv",
    "LANG",
    "C.UTF-8",
    "--setenv",
    "CI",
    "true",
    "--setenv",
    "GIT_TERMINAL_PROMPT",
    "0",
    "--setenv",
    "GIT_OPTIONAL_LOCKS",
    "0",
    "--",
    ...argv,
  );
  return new Promise((resolve) => {
    const child = spawn("/usr/bin/bwrap", args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8" },
    });
    let status: CommandResult["status"] | undefined;
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let settled = false;
    const stop = (why: CommandResult["status"]) => {
      status ??= why;
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const abort = () => stop("cancelled");
    const timer = setTimeout(() => stop("timeout"), options.timeoutMs);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolve(
        result(
          status ?? (code === 0 ? "passed" : "failed"),
          code,
          stdout,
          stderr,
        ),
      );
    };
    const capture = (chunk: Buffer, stream: "stdout" | "stderr") => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) {
        stop("output-limit");
        return;
      }
      if (stream === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk: Buffer) => capture(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => capture(chunk, "stderr"));
    child.on("error", () => {
      status = "failed";
      stderr = "Verification sandbox could not start";
      finish(null);
    });
    child.on("close", finish);
  });
}
