import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import type { ProjectConfig } from "./config.js";
import { safeDescendant } from "./storage.js";
const exec = promisify(execFile);
export interface WorkspacePlan {
  repository: string;
  branch: string;
  baseSha: string;
  bare: string;
  cwd: string;
}
/** Arguments are constructed by trusted worker code, never parsed from issue text. */
export async function git(cwd: string, args: string[]): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  for (const name of Object.keys(env))
    if (name.startsWith("GIT_") && name !== "GIT_TERMINAL_PROMPT")
      delete env[name as keyof typeof env];
  try {
    return (
      await exec("git", args, {
        cwd,
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024,
        env,
      })
    ).stdout;
  } catch {
    throw new Error(
      "Git operation failed; reconcile repository state before retry",
    );
  }
}
async function exists(filename: string): Promise<boolean> {
  try {
    await lstat(filename);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
function identifier(value: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value))
    throw new Error("Invalid workspace identifier");
}
/** Call only after runtime mount preflight. This manager never opens a live project checkout. */
export class Worktrees {
  constructor(
    private readonly root: string,
    private readonly remote: (project: ProjectConfig) => string = (p) =>
      `https://github.com/${p.repository}.git`,
    private readonly author?: { name: string; email: string },
  ) {}
  private async configureAuthor(bare: string): Promise<void> {
    if (!this.author) return;
    await git(bare, ["config", "--local", "user.name", this.author.name]);
    await git(bare, ["config", "--local", "user.email", this.author.email]);
  }
  private async paths(
    project: ProjectConfig,
    job: { id: string; issue: number; generation: number },
  ): Promise<{ bare: string; cwd: string; branch: string }> {
    identifier(project.id);
    identifier(job.id);
    if (
      !Number.isSafeInteger(job.issue) ||
      job.issue < 1 ||
      !Number.isSafeInteger(job.generation) ||
      job.generation < 0
    )
      throw new Error("Invalid workspace identifier");
    if ((await realpath(this.root)) !== this.root)
      throw new Error("Runtime root must be canonical");
    const bare = path.join(this.root, "repositories", `${project.id}.git`),
      cwd = path.join(this.root, "worktrees", job.id);
    safeDescendant(this.root, bare);
    safeDescendant(this.root, cwd);
    return {
      bare,
      cwd,
      branch: `prime-mover/${project.id}/issue-${job.issue}-g${job.generation}`,
    };
  }
  async plan(
    project: ProjectConfig,
    job: { id: string; issue: number; generation: number },
  ): Promise<WorkspacePlan> {
    const locations = await this.paths(project, job);
    const remote = this.remote(project);
    if (!remote || remote.startsWith("-") || /[\x00-\x1f]/.test(remote))
      throw new Error("Invalid trusted repository remote");
    // Validate branch syntax before constructing a refspec, which is not issue supplied.
    await git(this.root, [
      "check-ref-format",
      `refs/heads/${project.baseBranch}`,
    ]);
    await mkdir(path.dirname(locations.bare), { recursive: true, mode: 0o700 });
    if (!(await exists(locations.bare)))
      await git(this.root, ["clone", "--bare", "--", remote, locations.bare]);
    safeDescendant(this.root, locations.bare);
    if (
      (
        await git(locations.bare, ["rev-parse", "--is-bare-repository"])
      ).trim() !== "true" ||
      (await git(locations.bare, ["remote", "get-url", "origin"])).trim() !==
        remote
    )
      throw new Error("Worker repository identity mismatch");
    await git(locations.bare, [
      "fetch",
      "--no-tags",
      "origin",
      `+refs/heads/${project.baseBranch}:refs/remotes/origin/${project.baseBranch}`,
    ]);
    const baseSha = (
      await git(locations.bare, [
        "rev-parse",
        "--verify",
        `refs/remotes/origin/${project.baseBranch}^{commit}`,
      ])
    ).trim();
    if (!/^[a-f0-9]{40}$/.test(baseSha)) throw new Error("Invalid base commit");
    return { ...locations, repository: project.repository, baseSha };
  }
  private async identity(plan: WorkspacePlan): Promise<void> {
    safeDescendant(this.root, plan.bare);
    safeDescendant(this.root, plan.cwd);
    if (
      path.dirname(plan.bare) !== path.join(this.root, "repositories") ||
      path.dirname(plan.cwd) !== path.join(this.root, "worktrees")
    )
      throw new Error("Unexpected workspace location");
    if (
      !/^[a-f0-9]{40}$/.test(plan.baseSha) ||
      !/^prime-mover\/[a-zA-Z0-9_-]+\/issue-[1-9]\d*-g\d+$/.test(plan.branch)
    )
      throw new Error("Invalid recorded workspace plan");
    if (
      (await git(plan.cwd, ["symbolic-ref", "--short", "HEAD"])).trim() !==
      plan.branch
    )
      throw new Error("Workspace branch changed; reconcile");
    const common = (
      await git(plan.cwd, [
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ])
    ).trim();
    if ((await realpath(common)) !== (await realpath(plan.bare)))
      throw new Error("Workspace repository changed; reconcile");
    await git(plan.cwd, ["merge-base", "--is-ancestor", plan.baseSha, "HEAD"]);
  }
  async create(plan: WorkspacePlan): Promise<void> {
    safeDescendant(this.root, plan.bare);
    safeDescendant(this.root, plan.cwd);
    if (
      path.dirname(plan.bare) !== path.join(this.root, "repositories") ||
      path.dirname(plan.cwd) !== path.join(this.root, "worktrees")
    )
      throw new Error("Unexpected workspace location");
    if (
      !/^[a-f0-9]{40}$/.test(plan.baseSha) ||
      !/^prime-mover\/[a-zA-Z0-9_-]+\/issue-[1-9]\d*-g\d+$/.test(plan.branch)
    )
      throw new Error("Invalid recorded workspace plan");
    await mkdir(path.dirname(plan.cwd), { recursive: true, mode: 0o700 });
    if (!(await exists(plan.cwd))) {
      const branches = (
        await git(plan.bare, [
          "for-each-ref",
          "--format=%(refname)",
          `refs/heads/${plan.branch}`,
        ])
      ).split("\n");
      if (!branches.includes(`refs/heads/${plan.branch}`))
        await git(plan.bare, ["branch", plan.branch, plan.baseSha]);
      else if (
        (
          await git(plan.bare, ["rev-parse", `refs/heads/${plan.branch}`])
        ).trim() !== plan.baseSha
      )
        throw new Error(
          "Existing branch without worktree has moved; reconcile",
        );
      await git(plan.bare, ["worktree", "add", "--", plan.cwd, plan.branch]);
    }
    await this.identity(plan);
    await this.configureAuthor(plan.bare);
  }
  async check(plan: WorkspacePlan, project: ProjectConfig): Promise<string[]> {
    if (plan.repository !== project.repository)
      throw new Error("Workspace project attribution mismatch");
    await this.identity(plan);
    const changed = (
      await git(plan.cwd, [
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        plan.baseSha,
        "--",
      ])
    ).split("\0");
    const untracked = (
      await git(plan.cwd, ["ls-files", "--others", "--exclude-standard", "-z"])
    ).split("\0");
    const paths = [
      ...new Set([...changed, ...untracked].filter(Boolean)),
    ].sort();
    if (!paths.length) throw new Error("No changes produced");
    for (const name of paths) {
      if (
        path.isAbsolute(name) ||
        path.posix.normalize(name) !== name ||
        name === ".." ||
        name.startsWith("../") ||
        !project.allowedPaths.some(
          (p) => name === p || name.startsWith(`${p}/`),
        )
      )
        throw new Error("Changed file is outside allowed paths");
      const filename = path.join(plan.cwd, name);
      safeDescendant(plan.cwd, filename);
      if ((await exists(filename)) && (await lstat(filename)).isDirectory())
        throw new Error("Submodule/directory output is not supported");
      const mode = (
        await git(plan.cwd, ["ls-files", "--stage", "--", name])
      ).slice(0, 6);
      if (mode === "120000" || mode === "160000")
        throw new Error("Symlink/submodule output is not supported");
    }
    return paths;
  }
}
