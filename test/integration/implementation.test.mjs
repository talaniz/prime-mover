import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Store } from "../../dist/store.js";
import { Worktrees } from "../../dist/worktree.js";
import { Publication } from "../../dist/publication.js";
import { Implementation } from "../../dist/implementation.js";
import { Scheduler } from "../../dist/scheduler.js";
import { assessIssue } from "../../dist/intake-policy.js";
function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
async function fixture(t, mode = "success") {
  const root = mkdtempSync(join(tmpdir(), "pm-implementation-"));
  const config = JSON.parse(readFileSync("config.example.json"));
  const project = {
    ...config.projects[0],
    setup: [],
    verify: [
      [
        "node",
        "-e",
        mode === "verification-failed"
          ? "process.exit(1)"
          : `require('assert').equal(require('fs').readFileSync('README.md','utf8'),'Implemented')`,
      ],
    ],
    allowedPaths: ["README.md"],
  };
  config.projects = [project];
  const source = join(root, "source");
  mkdirSync(source);
  git(source, "init", "-b", "main");
  git(source, "config", "user.name", "Fixture");
  git(source, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(source, "README.md"), "Initial");
  git(source, "add", ".");
  git(source, "commit", "-m", "Initial");
  const remote = join(root, "remote.git");
  git(root, "clone", "--bare", source, remote);
  const runtime = join(root, "runtime");
  mkdirSync(runtime);
  config.storage.root = runtime;
  const store = new Store(join(root, "db"));
  store.seedProjects([project]);
  const issue = {
    repository: project.repository,
    number: 1,
    title: "Fixture",
    body: "## Objective\nImplement\n## Scope\nREADME.md\n## Acceptance criteria\nContains Implemented\n## Verification\nConfigured assertion",
    state: "open",
    labels: ["codex-ready"],
    updatedAt: "2026-09-20T00:00:00Z",
    isPullRequest: false,
  };
  const snapshot = {
    issue,
    decision: assessIssue(project, issue, [
      {
        id: "1",
        actor: "talaniz",
        label: "codex-ready",
        event: "labeled",
        createdAt: "2026-09-20T00:00:00Z",
      },
    ]),
  };
  const id = store.enqueue(project.id, 1, snapshot);
  const trees = new Worktrees(runtime, () => remote);
  let observations = 0;
  let starts = 0,
    posts = 0,
    guards = 0;
  const agent = {
    start: async (ctx, input) => {
      starts++;
      git(input.cwd, "config", "user.name", "Fixture");
      git(input.cwd, "config", "user.email", "fixture@example.invalid");
      if (mode !== "no-op")
        writeFileSync(join(input.cwd, "README.md"), "Implemented");
      store.recordObservedTurn(ctx.lease, "fixture-task", "fixture-turn");
      return {
        key: input.key,
        cwd: input.cwd,
        threadId: "fixture-task",
        turnId: "fixture-turn",
        clientId: "fixture-client",
        source: "fixture-source",
        deadline: Date.now() + 5000,
      };
    },
    observe: async (ctx) => {
      if (mode === "approval") return "waiting";
      if (mode === "slow" && ++observations < 20) return "active";
      store.finishTurn(ctx.lease, "fixture-turn");
      return mode === "agent-failed" ? "failed" : "completed";
    },
  };
  const api = {
    list: async () => [],
    create: async (repo, input) => {
      posts++;
      return {
        number: 1,
        url: `https://github.com/${repo}/pull/1`,
        head: git(remote, "rev-parse", `refs/heads/${input.branch}`),
        base: git(remote, "rev-parse", "refs/heads/main"),
        branch: input.branch,
        baseBranch: "main",
        state: "open",
        body: input.body,
      };
    },
  };
  const intake = {
    authorize: async () => {
      guards++;
      return snapshot;
    },
  };
  const publication = new Publication(store, trees, api, () => remote, id => intake.authorize(id));
  const worker = new Implementation(
    store,
    config,
    intake,
    trees,
    agent,
    publication,
    { pollMs: 1, approvalWaitMs: 5 },
  );
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    id,
    remote,
    worker,
    scheduler: new Scheduler(store, "fixture-worker"),
    get posts() {
      return posts;
    },
    get starts() {
      return starts;
    },
    get guards() {
      return guards;
    },
  };
}
test("implementation connects isolated work, actual verification, commit/push and draft PR evidence", async (t) => {
  const f = await fixture(t);
  assert.equal(
    await f.scheduler.runOnce((ctx) => f.worker.run(ctx)),
    "pr-open",
  );
  const job = f.store.job(f.id);
  assert.equal(job.prNumber, 1);
  assert.equal(job.leaseOwner, null);
  assert.equal(job.activeTurnId, null);
  assert.equal(f.posts, 1);
  assert.equal(f.starts, 1);
  assert.ok(f.guards >= 3);
  assert.ok(
    f.store
      .operations(f.id)
      .some((o) => o.kind === "verification" && o.status === "done"),
  );
});
for (const mode of ["verification-failed", "agent-failed", "no-op"])
  test(`${mode} blocks publication and never signals ready`, async (t) => {
    const f = await fixture(t, mode);
    await f.scheduler.runOnce((ctx) => f.worker.run(ctx));
    const job = f.store.job(f.id);
    assert.equal(job.stage, "blocked");
    assert.equal(f.posts, 0);
    assert.equal(job.prNumber, null);
    assert.equal(
      job.blockCode,
      mode === "verification-failed"
        ? "verification-failed"
        : mode === "agent-failed"
          ? "implementation-failed"
          : "implementation-no-op",
    );
  });
test("unresolved approval is an honest waiting state with its active turn retained", async (t) => {
  const f = await fixture(t, "approval");
  assert.equal(
    await f.scheduler.runOnce((ctx) => f.worker.run(ctx)),
    "reconciliation-required",
  );
  assert.equal(f.store.job(f.id).stage, "waiting");
  assert.equal(f.store.job(f.id).blockCode, "approval-required");
  assert.equal(f.store.job(f.id).activeTurnId, "fixture-turn");
  assert.equal(f.posts, 0);
});

test("active-turn observation does not poll GitHub faster than configured intake cadence", async (t) => {
  const f = await fixture(t, "slow");
  assert.equal(await f.scheduler.runOnce(ctx => f.worker.run(ctx)), "pr-open");
  assert.ok(f.guards <= 8, `unexpected GitHub authorization polls: ${f.guards}`);
});
