import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Worktrees } from "../../dist/worktree.js";
const projects = JSON.parse(readFileSync("config.example.json")).projects;
function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pm-worktree-"));
  const origin = join(root, "upstream");
  mkdirSync(origin);
  git(origin, "init", "-b", "main");
  git(origin, "config", "user.name", "Fixture");
  git(origin, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(origin, "README.md"), "Initial\n");
  git(origin, "add", "README.md");
  git(origin, "commit", "-m", "Initial");
  const runtime = join(root, "runtime");
  mkdirSync(runtime);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return {
    root,
    origin,
    runtime,
    manager: new Worktrees(runtime, () => origin),
  };
}
for (const project of projects)
  test(`isolated pinned workspace for ${project.id} survives repeated preparation`, async (t) => {
    const f = fixture(t);
    const plan = await f.manager.plan(project, {
      id: `job-${project.id}`,
      issue: 9,
      generation: 0,
    });
    assert.match(plan.baseSha, /^[a-f0-9]{40}$/);
    assert.equal(plan.branch, `prime-mover/${project.id}/issue-9-g0`);
    assert.equal(plan.repository, project.repository);
    assert.notEqual(plan.cwd, f.origin);
    writeFileSync(join(f.origin, "README.md"), "Upstream advanced\n");
    git(f.origin, "commit", "-am", "Advance main");
    await f.manager.create(plan);
    assert.equal(git(plan.cwd, "rev-parse", "HEAD"), plan.baseSha);
    writeFileSync(join(plan.cwd, "README.md"), "Implementation\n");
    await f.manager.create(plan);
    assert.equal(
      readFileSync(join(plan.cwd, "README.md"), "utf8"),
      "Implementation\n",
    );
    assert.equal(
      readFileSync(join(f.origin, "README.md"), "utf8"),
      "Upstream advanced\n",
    );
    assert.deepEqual(await f.manager.check(plan, project), ["README.md"]);
  });
test("recorded branch creation is reconciled before worktree creation, without resetting", async (t) => {
  const f = fixture(t);
  const plan = await f.manager.plan(projects[0], {
    id: "job-crash",
    issue: 1,
    generation: 0,
  });
  assert.ok(plan.bare);
  git(plan.bare, "branch", plan.branch, plan.baseSha);
  await f.manager.create(plan);
  await f.manager.create(plan);
  assert.equal(git(plan.cwd, "branch", "--show-current"), plan.branch);
});
test("invalid job identifiers and symlink destinations cannot escape runtime root", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    f.manager.plan(projects[0], { id: "../../live", issue: 1, generation: 0 }),
    /identifier/,
  );
  mkdirSync(join(f.runtime, "worktrees"));
  symlinkSync(f.origin, join(f.runtime, "worktrees", "job-link"));
  await assert.rejects(
    f.manager.plan(projects[0], { id: "job-link", issue: 1, generation: 0 }),
    /symlink/,
  );
});
test("changed files outside configured paths, symlinks and no-op output fail verification", async (t) => {
  const f = fixture(t);
  const plan = await f.manager.plan(projects[0], {
    id: "job-scope",
    issue: 3,
    generation: 0,
  });
  assert.ok(plan.baseSha);
  await f.manager.create(plan);
  await assert.rejects(f.manager.check(plan, projects[0]), /No changes/);
  writeFileSync(join(plan.cwd, "unexpected.txt"), "Outside scope");
  await assert.rejects(f.manager.check(plan, projects[0]), /allowed/);
  rmSync(join(plan.cwd, "unexpected.txt"));
  symlinkSync("/etc/passwd", join(plan.cwd, "README.md.new"));
  const p = { ...projects[0], allowedPaths: ["README.md.new"] };
  await assert.rejects(f.manager.check(plan, p), /symlink/);
  assert.equal(existsSync(join(f.origin, "unexpected.txt")), false);
});
test("repository attribution and changed worktree branch cannot be silently accepted", async (t) => {
  const f = fixture(t);
  const plan = await f.manager.plan(projects[0], {
    id: "job-attribution",
    issue: 6,
    generation: 0,
  });
  await f.manager.create(plan);
  writeFileSync(join(plan.cwd, "README.md"), "Changed");
  await assert.rejects(f.manager.check(plan, projects[1]), /attribution/);
  git(plan.cwd, "checkout", "-b", "unrelated");
  await assert.rejects(f.manager.create(plan), /branch changed/);
  assert.equal(git(plan.cwd, "branch", "--show-current"), "unrelated");
});
test("operator Git identity is installed in the worker clone independently of developer checkout settings", async (t) => {
  const f = fixture(t);
  const manager = new Worktrees(f.runtime, () => f.origin, {
    name: "Worker Fixture",
    email: "worker@example.invalid",
  });
  const plan = await manager.plan(projects[0], {
    id: "job-author",
    issue: 8,
    generation: 0,
  });
  await manager.create(plan);
  let name = "";
  try {
    name = git(plan.cwd, "config", "--local", "--get", "user.name");
  } catch {}
  assert.equal(name, "Worker Fixture");
  assert.equal(
    git(plan.cwd, "config", "--local", "--get", "user.email"),
    "worker@example.invalid",
  );
});
