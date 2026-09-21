import type { ProjectConfig } from "./config.js";
import { git, type WorkspacePlan, type Worktrees } from "./worktree.js";
import type { PullApi } from "./publication.js";
import type { ReviewTarget } from "./reviews.js";
export interface ReviewInput {
  target: ReviewTarget;
  diff: string;
  commits: { sha: string; diff: string }[];
}
/** Collect actual Git evidence, rejecting drift instead of reviewing a guessed target. */
export class ReviewInputs {
  constructor(
    private readonly trees: Worktrees,
    private readonly api: PullApi,
  ) {}
  async collect(
    plan: WorkspacePlan,
    project: ProjectConfig,
    pr: number,
  ): Promise<ReviewInput> {
    await this.trees.check(plan, project);
    const clean = async () => {
      if (
        (
          await git(plan.cwd, [
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
          ])
        ).trim()
      )
        throw new Error("Uncommitted review workspace changes");
    };
    await clean();
    const head = (await git(plan.cwd, ["rev-parse", "HEAD"])).trim();
    const pulls = await this.api.list(project.repository, plan.branch);
    if (pulls.length !== 1 || pulls[0]!.number !== pr)
      throw new Error("Review PR identity mismatch");
    const pull = pulls[0]!;
    if (
      pull.head !== head ||
      pull.base !== plan.baseSha ||
      pull.state !== "open" ||
      pull.branch !== plan.branch ||
      pull.baseBranch !== project.baseBranch
    )
      throw new Error("Review PR head/base target changed");
    const shas = (
      await git(plan.cwd, [
        "rev-list",
        "--reverse",
        "--topo-order",
        `${plan.baseSha}..${head}`,
      ])
    )
      .trim()
      .split("\n");
    if (
      !shas.length ||
      shas.length > 1000 ||
      shas.some((s) => !/^[a-f0-9]{40}$/.test(s)) ||
      shas.at(-1) !== head
    )
      throw new Error("Review commit coverage unavailable");
    const diff = await git(plan.cwd, [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      plan.baseSha,
      head,
      "--",
    ]);
    let bytes = Buffer.byteLength(diff);
    const commits: ReviewInput["commits"] = [];
    for (const sha of shas) {
      const patch = await git(plan.cwd, [
        "show",
        "--format=fuller",
        "--stat",
        "--patch",
        "--no-ext-diff",
        "--no-textconv",
        "--diff-merges=first-parent",
        sha,
        "--",
      ]);
      bytes += Buffer.byteLength(patch);
      if (bytes > 512 * 1024)
        throw new Error(
          "Review evidence exceeds bounded input; operator action required",
        );
      commits.push({ sha, diff: patch });
    }
    await clean();
    if ((await git(plan.cwd, ["rev-parse", "HEAD"])).trim() !== head)
      throw new Error("Review head changed while collecting evidence");
    return {
      target: { head, base: plan.baseSha, commits: shas },
      diff,
      commits,
    };
  }
}
