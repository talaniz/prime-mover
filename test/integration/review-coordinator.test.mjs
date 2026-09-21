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
import { Store } from "../../dist/store.js";
import { Worktrees } from "../../dist/worktree.js";
import { Publication } from "../../dist/publication.js";
import { ReviewInputs } from "../../dist/review-input.js";
import { PrComments } from "../../dist/pr-comments.js";
import { ReviewCoordinator } from "../../dist/review-coordinator.js";
import { Scheduler } from "../../dist/scheduler.js";
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
async function fixture(t, mode = "success") {
  const root = mkdtempSync(join(tmpdir(), "pm-review-cycle-")),
    source = join(root, "source"),
    remote = join(root, "remote.git"),
    runtime = join(root, "runtime");
  mkdirSync(source);
  mkdirSync(runtime);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(source, "init", "-b", "main");
  git(source, "config", "user.name", "Fixture");
  git(source, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(source, "README.md"), "Initial");
  git(source, "add", ".");
  git(source, "commit", "-m", "Initial");
  git(root, "clone", "--bare", source, remote);
  const config = JSON.parse(readFileSync("config.example.json"));
  config.storage.root = runtime;
  config.limits.correctionCycles = 1;
  const project = {
    ...config.projects[0],
    setup: [],
    allowedPaths: ["README.md", "test"],
    verify: [["node", "--test", "test/fixture.test.mjs"]],
  };
  config.projects = [project];
  const store = new Store(join(runtime, "db"));
  t.after(() => store.close());
  store.seedProjects([project]);
  const contract = {
    objective: "Correct the content",
    scope: "README.md and test",
    acceptance: "README contains Corrected",
    verification: "Meaningful node:test regression",
  };
  const snapshot = {
    issue: { number: 1, title: "Fixture", body: "Fixture" },
    decision: { contract },
  };
  const id = store.enqueue(project.id, 1, snapshot),
    lease = store.claim("implementation", 60000),
    context = {
      lease,
      signal: new AbortController().signal,
      assertActive: () => store.assertWorker(lease),
    };
  const trees = new Worktrees(runtime, () => remote, {
      name: "Fixture",
      email: "fixture@example.invalid",
    }),
    plan = await trees.plan(project, { id, issue: 1, generation: 0 });
  await trees.create(plan);
  writeFileSync(join(plan.cwd, "README.md"), "Bug");
  mkdirSync(join(plan.cwd, "test"));
  writeFileSync(
    join(plan.cwd, "test/fixture.test.mjs"),
    "import test from 'node:test';test('initial smoke',()=>{});",
  );
  const comments = [];
  let posts = 0,
    fixes = 0,
    reviews = 0;
  const taskIds = [];
  const pull = {
    number: 3,
    url: `https://github.com/${project.repository}/pull/3`,
    head: "",
    base: plan.baseSha,
    branch: plan.branch,
    baseBranch: "main",
    state: "open",
    body: "Seeded fixture PR",
  };
  const api = {
    list: async () => [
      { ...pull, head: git(remote, "rev-parse", `refs/heads/${plan.branch}`) },
    ],
    create: async () => {
      throw Error("Do not create another PR");
    },
  };
  const intake = { authorize: async () => snapshot },
    publication = new Publication(
      store,
      trees,
      api,
      () => remote,
      intake.authorize,
    );
  const head = await publication.commit(context, plan, project);
  git(plan.cwd, "push", remote, `${head}:refs/heads/${plan.branch}`);
  for (const [key, kind, input, result] of [
    ["workspace-plan", "workspace-plan", {}, plan],
    [
      "implementation-budget",
      "execution-budget",
      { deadline: Date.now() + 120000 },
      {},
    ],
    [
      "implementation-0:thread",
      "thread-start",
      { role: "implementation", cwd: plan.cwd, source: "fixture" },
      { threadId: "implementer" },
    ],
    [
      `push:${head}`,
      "push",
      { repository: project.repository, branch: plan.branch, head },
      { head },
    ],
    [
      "implementation-pr",
      "pull-create",
      {
        branch: plan.branch,
        baseBranch: "main",
        title: "Fixture",
        body: pull.body,
      },
      { number: 3, url: pull.url },
    ],
  ]) {
    store.operation(lease, key, kind, input);
    store.completeOperation(lease, key, result);
  }
  store.transition(lease, "implementing");
  store.transition(lease, "verifying");
  store.finishImplementation(lease, 3);
  const reviewLease = store.claimCodeReview(id, "reviewer", 60000);
  const results = new Map();
  const agent = {
    reuseTask: (ctx, from, key, role) => {
      const old = store.operations(id).find((o) => o.key === `${from}:thread`);
      assert.equal(old.input.role ?? "implementation", role);
      store.operation(ctx.lease, `${key}:thread`, "thread-start", old.input);
      store.completeOperation(ctx.lease, `${key}:thread`, old.result);
    },
    start: async (ctx, input) => {
      let task = store
        .operations(id)
        .find((o) => o.key === `${input.key}:thread`);
      if (!task) {
        const threadId =
          input.role === "code-review" ? "independent-reviewer" : "implementer";
        store.operation(ctx.lease, `${input.key}:thread`, "thread-start", {
          role: input.role ?? "implementation",
          cwd: plan.cwd,
          source: "fixture",
        });
        store.completeOperation(ctx.lease, `${input.key}:thread`, { threadId });
        task = store
          .operations(id)
          .find((o) => o.key === `${input.key}:thread`);
        taskIds.push(threadId);
      }
      const threadId = task.result.threadId,
        turnId = `${input.key}-turn`;
      store.operation(ctx.lease, `${input.key}:turn`, "turn-start", {
        threadId,
        prompt: input.prompt,
      });
      store.completeOperation(ctx.lease, `${input.key}:turn`, { turnId });
      store.recordObservedTurn(ctx.lease, threadId, turnId);
      if (input.role === "code-review") {
        reviews++;
        const shas = git(
          plan.cwd,
          "rev-list",
          "--reverse",
          `${plan.baseSha}..HEAD`,
        ).split("\n");
        const finding = {
          id: "code-review-1-F1",
          severity: "P1",
          file: "README.md",
          line: 1,
          observed: "Bug instead of Corrected",
          expected: "Corrected",
          acceptance: contract.acceptance,
          verification: contract.verification,
        };
        results.set(
          turnId,
          JSON.stringify({
            head: shas.at(-1),
            base: plan.baseSha,
            commits: shas,
            verdict: reviews === 1 ? "changes-requested" : "sign-off",
            checks: ["Inspected all commits and actual README"],
            limitations: [],
            findings: reviews === 1 ? [finding] : [],
            resolutions:
              reviews === 1
                ? []
                : [
                    {
                      findingId: finding.id,
                      decision: "resolved",
                      reason: "Inspected correction and passing regression",
                    },
                  ],
          }),
        );
      } else if (input.key.startsWith("triage-")) {
        results.set(
          turnId,
          JSON.stringify({
            dispositions: [
              {
                findingId:
                  mode === "invalid-triage" ? "unknown" : "code-review-1-F1",
                decision: "accepted",
                reason: "Reproduced requested content mismatch",
                acceptance: contract.acceptance,
                verification: contract.verification,
              },
            ],
          }),
        );
      } else {
        fixes++;
        assert.match(input.prompt, /README contains Corrected/);
        writeFileSync(join(plan.cwd, "README.md"), "Corrected");
        writeFileSync(
          join(plan.cwd, "test/fixture.test.mjs"),
          `import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('regression',()=>assert.equal(readFileSync('README.md','utf8'),'${mode === "failed-check" ? "Wrong" : "Corrected"}'));`,
        );
        results.set(turnId, "Implemented regression and correction");
      }
      return {
        key: input.key,
        threadId,
        turnId,
        cwd: plan.cwd,
        source: "fixture",
        clientId: "fixture",
        deadline: Date.now() + 10000,
      };
    },
    observe: async (ctx, run) => {
      store.finishTurn(ctx.lease, run.turnId);
      return "completed";
    },
    result: async (_ctx, run) => results.get(run.turnId),
  };
  const github = {
    identity: async () => "talaniz",
    comments: async () => ({ items: comments, next: null }),
    comment: async (_repo, _pr, body) => {
      const id = String(++posts);
      comments.push({ id, body, actor: "talaniz" });
      return id;
    },
  };
  const coordinator = new ReviewCoordinator(
    store,
    config,
    {
      agent,
      inputs: new ReviewInputs(trees, api),
      comments: new PrComments(store, github, intake.authorize),
      publication,
      intake,
    },
    { pollMs: 1 },
  );
  return {
    store,
    id,
    plan,
    remote,
    reviewLease,
    coordinator,
    comments,
    taskIds,
    scheduler: new Scheduler(store, "reviewer"),
    get fixes() {
      return fixes;
    },
    get reviews() {
      return reviews;
    },
  };
}
test("seeded finding runs through public triage, verified correction and same-reviewer sign-off", async (t) => {
  const f = await fixture(t);
  const result = await f.scheduler.runClaimed(f.reviewLease, (ctx) =>
    f.coordinator.run(ctx),
  );
  assert.equal(result, "e2e-review");
  assert.equal(f.fixes, 1);
  assert.equal(f.reviews, 2);
  assert.deepEqual(f.taskIds, ["independent-reviewer"]);
  assert.equal(
    readFileSync(join(f.plan.cwd, "README.md"), "utf8"),
    "Corrected",
  );
  assert.equal(
    git(f.remote, "rev-parse", `refs/heads/${f.plan.branch}`),
    git(f.plan.cwd, "rev-parse", "HEAD"),
  );
  assert.ok(
    f.comments.some(
      (c) =>
        /accepted/.test(c.body) && /README contains Corrected/.test(c.body),
    ),
  );
  assert.ok(f.comments.some((c) => /exit 0/.test(c.body)));
  assert.equal(f.store.job(f.id).leaseOwner, null);
});
for (const mode of ["failed-check", "invalid-triage"])
  test(`${mode} blocks the correction loop without sign-off`, async (t) => {
    const f = await fixture(t, mode);
    await f.scheduler.runClaimed(f.reviewLease, (ctx) =>
      f.coordinator.run(ctx),
    );
    assert.equal(f.store.job(f.id).stage, "blocked");
    assert.equal(f.reviews, 1);
    assert.equal(f.fixes, mode === "invalid-triage" ? 0 : 1);
    assert.notEqual(f.store.job(f.id).stage, "e2e-review");
  });
