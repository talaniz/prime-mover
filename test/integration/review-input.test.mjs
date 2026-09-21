import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { Worktrees } from "../../dist/worktree.js";
import { ReviewInputs } from "../../dist/review-input.js";
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pm-review-input-")),
    remote = join(root, "source");
  mkdirSync(remote);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(remote, "init", "-b", "main");
  git(remote, "config", "user.name", "Fixture");
  git(remote, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(remote, "README.md"), "Initial\n");
  git(remote, "add", ".");
  git(remote, "commit", "-m", "Initial");
  const project = {
    ...JSON.parse(readFileSync("config.example.json")).projects[0],
    allowedPaths: ["README.md"],
  };
  const runtime = join(root, "runtime");
  mkdirSync(runtime);
  const trees = new Worktrees(runtime, () => remote, {
    name: "Fixture",
    email: "fixture@example.invalid",
  });
  const plan = await trees.plan(project, {
    id: "review-job",
    issue: 1,
    generation: 0,
  });
  await trees.create(plan);
  const commits = [];
  for (const text of ["First change", "Second change"]) {
    writeFileSync(join(plan.cwd, "README.md"), text + "\n");
    git(plan.cwd, "add", "README.md");
    git(plan.cwd, "commit", "-m", text);
    commits.push(git(plan.cwd, "rev-parse", "HEAD"));
  }
  const pull = {
    number: 3,
    url: `https://github.com/${project.repository}/pull/3`,
    head: commits[1],
    base: plan.baseSha,
    branch: plan.branch,
    baseBranch: "main",
    state: "open",
    body: "Contract",
  };
  const api = {
    list: async () => [pull],
    create: async () => {
      throw Error("Must not create PR");
    },
  };
  return { plan, project, commits, pull, inputs: new ReviewInputs(trees, api) };
}
test("review input contains every actual commit and combined diff at the published head/base", async (t) => {
  const f = await fixture(t),
    input = await f.inputs.collect(f.plan, f.project, 3);
  assert.deepEqual(input.target, {
    head: f.commits[1],
    base: f.plan.baseSha,
    commits: f.commits,
  });
  assert.deepEqual(
    input.commits.map((c) => c.sha),
    f.commits,
  );
  assert.match(input.commits[0].diff, /First change/);
  assert.match(input.commits[1].diff, /Second change/);
  assert.match(input.diff, /-Initial/);
  assert.match(input.diff, /\+Second change/);
});
test("changed remote head/base, wrong PR and dirty worktree cannot be reviewed as the recorded target", async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.inputs.collect(f.plan, f.project, 99), /PR|identity/i);
  f.pull.head = "f".repeat(40);
  await assert.rejects(f.inputs.collect(f.plan, f.project, 3), /head|target/i);
  f.pull.head = f.commits[1];
  f.pull.base = "f".repeat(40);
  await assert.rejects(f.inputs.collect(f.plan, f.project, 3), /base|target/i);
  f.pull.base = f.plan.baseSha;
  writeFileSync(join(f.plan.cwd, "README.md"), "Uncommitted");
  await assert.rejects(
    f.inputs.collect(f.plan, f.project, 3),
    /dirty|uncommitted/i,
  );
});
