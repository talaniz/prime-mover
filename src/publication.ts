import { randomUUID } from "node:crypto";
import type { Store } from "./store.js";
import type { WorkContext } from "./scheduler.js";
import type { ProjectConfig } from "./config.js";
import { git, type WorkspacePlan, type Worktrees } from "./worktree.js";
import type { VerificationResult } from "./contracts.js";
import { ghTransport, type Transport } from "./github.js";
export interface PublishedPull {
  number: number;
  url: string;
  head: string;
  base: string;
  branch: string;
  baseBranch: string;
  state: string;
  body: string;
}
export interface PullApi {
  list(repository: string, branch: string): Promise<PublishedPull[]>;
  create(
    repository: string,
    input: { branch: string; baseBranch: string; title: string; body: string },
  ): Promise<PublishedPull>;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid publication evidence");
  return value as Record<string, unknown>;
}
function repo(value: string): void {
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(value))
    throw new Error("Invalid publication repository");
}
function pull(repository: string, value: unknown): PublishedPull {
  const r = object(value),
    head = object(r.head),
    base = object(r.base);
  if (
    !Number.isSafeInteger(r.number) ||
    Number(r.number) < 1 ||
    typeof head.sha !== "string" ||
    typeof base.sha !== "string" ||
    typeof head.ref !== "string" ||
    typeof base.ref !== "string" ||
    typeof r.body !== "string" ||
    typeof r.state !== "string" ||
    object(head.repo).full_name !== repository ||
    object(base.repo).full_name !== repository
  )
    throw new Error("Invalid pull request evidence");
  return {
    number: Number(r.number),
    url: `https://github.com/${repository}/pull/${r.number}`,
    head: head.sha,
    base: base.sha,
    branch: head.ref,
    baseBranch: base.ref,
    state: r.state,
    body: r.body,
  };
}
/** The worker owns creation; all generated PRs remain draft pending independent review. */
export class GitHubPulls implements PullApi {
  constructor(private readonly transport: Transport = ghTransport) {}
  async list(repository: string, branch: string): Promise<PublishedPull[]> {
    repo(repository);
    const result: PublishedPull[] = [];
    for (let page = 1; page <= 100; page++) {
      const response = await this.transport(
        "GET",
        `repos/${repository}/pulls?state=all&head=${encodeURIComponent(`${repository.split("/")[0]}:${branch}`)}&per_page=100&page=${page}`,
      );
      if (response.status !== 200 || !Array.isArray(response.body))
        throw new Error("Pull request lookup unavailable");
      result.push(...response.body.map((p) => pull(repository, p)));
      if (response.body.length < 100) return result;
    }
    throw new Error("Pull request pagination limit");
  }
  async create(
    repository: string,
    input: { branch: string; baseBranch: string; title: string; body: string },
  ): Promise<PublishedPull> {
    repo(repository);
    const response = await this.transport("POST", `repos/${repository}/pulls`, {
      head: input.branch,
      base: input.baseBranch,
      title: input.title,
      body: input.body,
      draft: true,
      maintainer_can_modify: false,
    });
    if (response.status !== 201)
      throw new Error("Pull creation uncertain; reconcile");
    return pull(repository, response.body);
  }
}
export class Publication {
  constructor(
    private readonly store: Store,
    private readonly trees: Worktrees,
    private readonly api: PullApi,
    private readonly remote: (p: ProjectConfig) => string = (p) =>
      `https://github.com/${p.repository}.git`,
    private readonly authorize: (jobId: string) => Promise<unknown>,
  ) {}
  async commit(
    context: WorkContext,
    plan: WorkspacePlan,
    project: ProjectConfig,
    key = "implementation",
  ): Promise<string> {
    context.assertActive();
    await this.trees.check(plan, project);
    if (!/^[a-z0-9-]+$/.test(key)) throw new Error("Invalid commit key");
    const opKey = `commit:${key}`;
    const previous = this.store
      .operations(context.lease.jobId)
      .find((o) => o.key === opKey);
    let head = (await git(plan.cwd, ["rev-parse", "HEAD"])).trim();
    if (previous?.status === "done") {
      if (
        object(previous.result).head !== head ||
        (
          await git(plan.cwd, [
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
          ])
        ).trim()
      )
        throw new Error("Committed workspace changed; reconcile");
      return head;
    }
    let input: Record<string, unknown>;
    if (previous) input = object(previous.input);
    else {
      const paths = await this.trees.check(plan, project);
      context.assertActive();
      await git(plan.cwd, ["add", "--", ...paths]);
      if (!(await git(plan.cwd, ["diff", "--cached", "--name-only"])).trim())
        throw new Error("No uncommitted implementation output");
      const tree = (await git(plan.cwd, ["write-tree"])).trim();
      const job = this.store.job(context.lease.jobId)!;
      input = {
        parent: head,
        tree,
        message: `Implement issue #${job.issue}\n\nPrime-Mover-Job: ${job.id}\nPrime-Mover-Generation: ${job.generation}`,
        repository: project.repository,
      };
    }
    this.store.operation(context.lease, opKey, "commit", input);
    if (head === input.parent) {
      if ((await git(plan.cwd, ["write-tree"])).trim() !== input.tree)
        throw new Error("Commit index changed; reconcile");
      context.assertActive();
      await git(plan.cwd, ["commit", "-m", String(input.message)]);
      head = (await git(plan.cwd, ["rev-parse", "HEAD"])).trim();
    }
    if (
      (await git(plan.cwd, ["show", "-s", "--format=%P", head])).trim() !==
        input.parent ||
      (await git(plan.cwd, ["show", "-s", "--format=%T", head])).trim() !==
        input.tree ||
      (await git(plan.cwd, ["show", "-s", "--format=%B", head])).trim() !==
        String(input.message).trim()
    )
      throw new Error("Commit result uncertain; reconcile");
    this.store.completeOperation(context.lease, opKey, { head });
    if (
      (
        await git(plan.cwd, [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ])
      ).trim()
    )
      throw new Error("Commit left unexpected changes");
    return head;
  }
  private async remoteHead(
    plan: WorkspacePlan,
    project: ProjectConfig,
    branch: string,
  ): Promise<string | null> {
    const lines = (
      await git(plan.cwd, [
        "ls-remote",
        "--heads",
        this.remote(project),
        `refs/heads/${branch}`,
      ])
    )
      .trim()
      .split("\n")
      .filter(Boolean);
    if (!lines.length) return null;
    const parts = lines[0]!.split(/\s+/);
    if (
      lines.length !== 1 ||
      !parts[0] ||
      !/^[a-f0-9]{40}$/.test(parts[0]) ||
      parts[1] !== `refs/heads/${branch}`
    )
      throw new Error("Remote branch identity uncertain");
    return parts[0];
  }
  async publish(
    context: WorkContext,
    plan: WorkspacePlan,
    project: ProjectConfig,
    evidence: VerificationResult[],
    contract: { title: string; body: string },
  ): Promise<PublishedPull> {
    context.assertActive();
    await this.trees.check(plan, project);
    const head = (await git(plan.cwd, ["rev-parse", "HEAD"])).trim();
    if (
      evidence.length !== project.verify.length ||
      !evidence.length ||
      evidence.some(
        (e, i) =>
          e.exitCode !== 0 ||
          e.headSha !== head ||
          JSON.stringify(e.argv) !== JSON.stringify(project.verify[i]) ||
          !e.artifact,
      )
    )
      throw new Error(
        "Current-head verification is required before publication",
      );
    if (
      (
        await git(plan.cwd, [
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
        ])
      ).trim()
    )
      throw new Error("Verification left uncommitted changes");
    if (
      (await this.remoteHead(plan, project, project.baseBranch)) !==
      plan.baseSha
    )
      throw new Error("Base branch changed; reconcile before publication");
    const remoteHead = await this.remoteHead(plan, project, plan.branch);
    const ownedHeads = this.store
      .operations(context.lease.jobId)
      .filter((o) => o.kind === "push" && o.status === "done")
      .map((o) => object(o.result).head);
    if (remoteHead && remoteHead !== head && !ownedHeads.includes(remoteHead))
      throw new Error("Remote branch changed outside this job");
    if (remoteHead && remoteHead !== head)
      await git(plan.cwd, ["merge-base", "--is-ancestor", remoteHead, head]);
    const pushKey = `push:${head}`;
    if (remoteHead !== head) await this.authorize(context.lease.jobId);
    context.assertActive();
    this.store.operation(context.lease, pushKey, "push", {
      repository: project.repository,
      branch: plan.branch,
      head,
    });
    if (remoteHead !== head) {
      context.assertActive();
      await git(plan.cwd, [
        "push",
        this.remote(project),
        `${head}:refs/heads/${plan.branch}`,
      ]);
    }
    if ((await this.remoteHead(plan, project, plan.branch)) !== head)
      throw new Error("Push uncertain; reconcile");
    this.store.completeOperation(context.lease, pushKey, { head });
    const key = "implementation-pr";
    const previous = this.store
      .operations(context.lease.jobId)
      .find((o) => o.key === key);
    const input = previous
      ? object(previous.input)
      : {
          branch: plan.branch,
          baseBranch: project.baseBranch,
          title: contract.title.replace(/\s+/g, " ").slice(0, 200),
          body: `${contract.body}\n\nImplementation head: ${head}\nRecorded base: ${plan.baseSha}\n\n<!-- prime-mover-pr:${context.lease.jobId}:${randomUUID()} -->`,
        };
    const candidates = await this.api.list(project.repository, plan.branch);
    const matches = candidates.filter(
      (p) =>
        p.body === input.body &&
        p.branch === plan.branch &&
        p.baseBranch === project.baseBranch,
    );
    if (matches.length > 1 || candidates.some((p) => !matches.includes(p)))
      throw new Error("Existing PR identity mismatch; reconcile");
    let pr = matches[0];
    if (!pr) {
      if (previous)
        throw new Error("PR creation uncertain; reconcile before another POST");
      await this.authorize(context.lease.jobId);
      context.assertActive();
      this.store.operation(context.lease, key, "pull-create", input);
      pr = await this.api.create(
        project.repository,
        input as unknown as {
          branch: string;
          baseBranch: string;
          title: string;
          body: string;
        },
      );
    }
    if (
      pr.head !== head ||
      pr.base !== plan.baseSha ||
      pr.branch !== plan.branch ||
      pr.baseBranch !== project.baseBranch ||
      pr.body !== input.body ||
      pr.state !== "open"
    )
      throw new Error("PR head/base/state mismatch; reconcile");
    this.store.operation(context.lease, key, "pull-create", input);
    this.store.completeOperation(context.lease, key, {
      number: pr.number,
      url: pr.url,
    });
    return pr;
  }
}
