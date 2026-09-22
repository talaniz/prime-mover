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
    reviews = 0,
    e2eReviews = 0;
  const roles = [];
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
      roles.push(input.role ?? "implementation");
      let task = store
        .operations(id)
        .find((o) => o.key === `${input.key}:thread`);
      if (!task) {
        const threadId =
          input.role === "e2e-review"
            ? "independent-e2e-reviewer"
            : input.role === "code-review"
              ? "independent-reviewer"
              : "implementer";
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
      if (input.role === "code-review" || input.role === "e2e-review") {
        const e2e = input.role === "e2e-review";
        if (e2e) e2eReviews++;
        else reviews++;
        const hasFinding = e2e
          ? e2eReviews === 1
          : mode !== "e2e" && mode !== "reassessment" && reviews === 1;
        const shas = git(
          plan.cwd,
          "rev-list",
          "--reverse",
          `${plan.baseSha}..HEAD`,
        ).split("\n");
        const finding = {
          id: mode === "e2e" ? "e2e-review-1-F1" : "code-review-1-F1",
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
            verdict:
              mode === "reassessment" &&
              !input.prompt.includes("ORIGINAL_RED_EVIDENCE")
                ? "blocked"
                : hasFinding
                  ? "changes-requested"
                  : "sign-off",
            ...(e2e
              ? {
                  acceptance: contract.acceptance,
                  workflows: [
                    {
                      kind: "success",
                      scenario: "Read actual README",
                      expected: "Corrected",
                      observed: readFileSync(
                        join(plan.cwd, "README.md"),
                        "utf8",
                      ),
                      passed: !hasFinding,
                    },
                    {
                      kind: "failure",
                      scenario: "Reject wrong content",
                      expected: "Mismatch detected",
                      observed: "Regression rejects wrong content",
                      passed: true,
                    },
                  ],
                }
              : {}),
            checks: ["Inspected all commits and actual README"],
            limitations:
              mode === "reassessment" &&
              !input.prompt.includes("ORIGINAL_RED_EVIDENCE")
                ? ["Original red evidence missing"]
                : [],
            findings: hasFinding ? [finding] : [],
            resolutions:
              hasFinding || mode === "reassessment" || (mode === "e2e" && !e2e)
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
      } else if (input.key.includes("triage-")) {
        results.set(
          turnId,
          JSON.stringify({
            dispositions: [
              {
                findingId:
                  mode === "invalid-triage"
                    ? "unknown"
                    : mode === "e2e"
                      ? "e2e-review-1-F1"
                      : "code-review-1-F1",
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
    config,
    roles,
    services: {
      agent,
      inputs: new ReviewInputs(trees, api),
      comments: new PrComments(store, github, intake.authorize),
      publication,
      intake,
    },
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

test("E2E workflow finding returns corrected code through code review before a fresh E2E sign-off", async (t) => {
  const f = await fixture(t, "e2e");
  assert.equal(
    await f.scheduler.runClaimed(f.reviewLease, (ctx) =>
      f.coordinator.run(ctx),
    ),
    "e2e-review",
  );
  const lease = f.store.claimE2EReview(f.id, "reviewer", 60000);
  const e2e = new ReviewCoordinator(f.store, f.config, f.services, {
    pollMs: 1,
    role: "e2e-review",
  });
  const result = await f.scheduler.runClaimed(lease, async (ctx) => {
    await e2e.run(ctx);
    const reports = f.store
      .operations(f.id)
      .filter((o) => o.kind === "e2e-review-report")
      .map((o) => o.result);
    assert.equal(reports.length, 2);
    assert.equal(reports[0].verdict, "changes-requested");
    assert.equal(reports[1].verdict, "sign-off");
    const code = f.store
      .operations(f.id)
      .filter((o) => o.kind === "code-review-report")
      .at(-1).result;
    assert.equal(code.head, reports[1].head);
    assert.notEqual(code.taskId, reports[1].taskId);
    const target = { head: code.head, base: code.base, commits: code.commits };
    const n = f.store.notification(lease, `ready:${code.head}:${code.base}`, {
      ...target,
      codeReview: code.reportUrl,
      e2eReview: reports[1].reportUrl,
    });
    f.store.acknowledgeNotification(lease, n.id, "100");
    f.store.finishReady(lease, {
      ...target,
      observedAt: Date.now(),
      open: true,
      mergeable: true,
      checks: [],
      requiredChecks: [],
    });
  });
  assert.equal(result, "ready");
  assert.equal(f.fixes, 1);
  assert.deepEqual(
    f.roles.filter((r) => r !== "implementation"),
    ["code-review", "e2e-review", "code-review", "e2e-review"],
  );
  assert.deepEqual(f.taskIds, [
    "independent-reviewer",
    "independent-e2e-reviewer",
  ]);
});

async function blockedReassessment(t) {
  const f = await fixture(t, "reassessment");
  assert.equal(
    await f.scheduler.runClaimed(f.reviewLease, (ctx) =>
      f.coordinator.run(ctx),
    ),
    "blocked",
  );
  assert.equal(f.store.job(f.id).blockCode, "reviewer-blocked");
  const last = f.store
    .operations(f.id)
    .filter((o) => o.kind === "turn-start")
    .at(-1);
  const lease = f.store.reclaimCodeReview(
    f.id,
    "operator",
    30000,
    "New evidence supplied",
    {
      threadId: last.input.threadId,
      turnId: last.result.turnId,
    },
  );
  const request = {
    requestId: "original-red-1",
    head: git(f.plan.cwd, "rev-parse", "HEAD"),
    base: f.plan.baseSha,
    evidence:
      "ORIGINAL_RED_EVIDENCE: original failing test output and owner clarification",
  };
  return { ...f, lease, request };
}
test("operator reassessment opens a fresh independent round with new evidence and preserves the blocked report", async (t) => {
  const f = await blockedReassessment(t);
  const before = f.store.operations(f.id);
  const budget = before.find((o) => o.key === "implementation-budget");
  const oldReport = before.find((o) => o.key === "code-review-1:round");
  const coordinator = new ReviewCoordinator(f.store, f.config, f.services, {
    pollMs: 1,
    reassessment: {
      request: f.request,
      reason: "Owner clarification and recovered original red output",
    },
  });
  assert.equal(
    await f.scheduler.runClaimed(f.lease, (ctx) => coordinator.run(ctx)),
    "e2e-review",
  );
  const after = f.store.operations(f.id);
  assert.deepEqual(
    after.find((o) => o.key === "implementation-budget"),
    budget,
  );
  assert.deepEqual(
    after.find((o) => o.key === "code-review-1:round"),
    oldReport,
  );
  assert.equal(
    after.find((o) => o.key === "code-review-2:round").result.verdict,
    "sign-off",
  );
  assert.equal(f.roles.filter((r) => r === "code-review").length, 2);
  assert.deepEqual(f.taskIds, ["independent-reviewer"]);
  assert.equal(
    f.store
      .events(f.id)
      .filter((e) => e.kind === "operator-review-reassessment").length,
    1,
  );
});

for (const mode of [
  "stale-target",
  "revoked",
  "expired",
  "pending",
  "round-limit",
  "active-turn",
  "paused",
  "changed-request",
]) {
  test(`reassessment rejects ${mode} without replacing reports or starting a reviewer`, async (t) => {
    const f = await blockedReassessment(t);
    const target = (
      await f.services.inputs.collect(f.plan, f.store.projects()[0], 3)
    ).target;
    if (mode === "stale-target") f.request.head = "f".repeat(40);
    if (mode === "revoked")
      f.services.intake.authorize = async () => {
        throw Error("Authorization revoked");
      };
    if (mode === "pending") f.store.operation(f.lease, "unrelated", "push", {});
    if (mode === "active-turn")
      f.store.recordObservedTurn(
        f.lease,
        "independent-reviewer",
        "uncertain-turn",
      );
    if (mode === "paused") f.store.setPaused(true);
    if (mode === "expired") {
      f.store.heartbeat(f.lease, 600000);
      f.store.now = () => Date.now() + 500000;
    }
    if (mode === "round-limit") {
      assert.throws(
        () =>
          f.store.reassessCodeReview(
            f.lease,
            f.request,
            "Evidence recovered",
            target,
            1,
          ),
        /budget exhausted/,
      );
      return;
    }
    if (mode === "changed-request") {
      f.store.reassessCodeReview(
        f.lease,
        f.request,
        "Evidence recovered",
        target,
        4,
      );
      assert.throws(
        () =>
          f.store.reassessCodeReview(
            f.lease,
            { ...f.request, evidence: "Different evidence" },
            "Evidence recovered",
            target,
            4,
          ),
        /already used/,
      );
      return;
    }
    const before = f.store.operations(f.id);
    const coordinator = new ReviewCoordinator(f.store, f.config, f.services, {
      pollMs: 1,
      reassessment: { request: f.request, reason: "Evidence recovered" },
    });
    await f.scheduler
      .runClaimed(f.lease, (ctx) => coordinator.run(ctx))
      .catch(() => {});
    assert.deepEqual(f.store.operations(f.id), before);
    assert.equal(f.roles.filter((r) => r === "code-review").length, 1);
  });
}
test("durable reassessment reservation survives interruption and duplicate request without resetting budgets", async (t) => {
  const f = await blockedReassessment(t);
  const target = (
    await f.services.inputs.collect(f.plan, f.store.projects()[0], 3)
  ).target;
  for (let i = 0; i < 3; i++)
    f.store.consumeBudget(f.lease, "recovery-attempts", 3);
  f.store.consumeBudget(f.lease, "correction-cycles", 1);
  const before = f.store.operations(f.id);
  assert.equal(
    f.store.reassessCodeReview(
      f.lease,
      f.request,
      "Evidence recovered",
      target,
      4,
    ),
    2,
  );
  const reserved = f.store.operations(f.id);
  assert.equal(
    f.store.reassessCodeReview(
      f.lease,
      f.request,
      "Evidence recovered",
      target,
      4,
    ),
    2,
  );
  assert.deepEqual(f.store.operations(f.id), reserved);
  assert.equal(f.store.budgetUsed(f.id, "recovery-attempts"), 3);
  assert.equal(f.store.budgetUsed(f.id, "correction-cycles"), 1);
  assert.deepEqual(
    reserved.find((o) => o.key === "code-review-1:round"),
    before.find((o) => o.key === "code-review-1:round"),
  );
  f.store.blockAndRelease(f.lease, "operator-interrupted");
  const last = reserved.filter((o) => o.kind === "turn-start").at(-1);
  const lease = f.store.reclaimCodeReview(
    f.id,
    "restart",
    30000,
    "Continue recorded request",
    { threadId: last.input.threadId, turnId: last.result.turnId },
  );
  // Ordinary continuation also sees the durable evidence after process loss.
  assert.equal(
    await f.scheduler.runClaimed(lease, (ctx) => f.coordinator.run(ctx)),
    "e2e-review",
  );
  assert.equal(f.roles.filter((r) => r === "code-review").length, 2);
  assert.equal(
    f.store
      .events(f.id)
      .filter((e) => e.kind === "operator-review-reassessment").length,
    1,
  );
});
test("ordinary resume keeps a genuine blocked report blocked", async (t) => {
  const f = await blockedReassessment(t);
  assert.equal(
    await f.scheduler.runClaimed(f.lease, (ctx) => f.coordinator.run(ctx)),
    "blocked",
  );
  assert.equal(f.store.job(f.id).blockCode, "reviewer-blocked");
  assert.equal(f.roles.filter((r) => r === "code-review").length, 1);
});

test("new evidence never forces sign-off and replay never opens a third round", async (t) => {
  const f = await blockedReassessment(t);
  f.request.evidence =
    "Insufficient context, independently assess the remaining gap";
  const options = {
    pollMs: 1,
    reassessment: {
      request: f.request,
      reason: "Please reassess this evidence",
    },
  };
  const coordinator = new ReviewCoordinator(
    f.store,
    f.config,
    f.services,
    options,
  );
  assert.equal(
    await f.scheduler.runClaimed(f.lease, (ctx) => coordinator.run(ctx)),
    "blocked",
  );
  assert.equal(f.store.job(f.id).blockCode, "reviewer-blocked");
  const ops = f.store.operations(f.id),
    last = ops.filter((o) => o.kind === "turn-start").at(-1);
  const lease = f.store.reclaimCodeReview(
    f.id,
    "repeat",
    30000,
    options.reassessment.reason,
    { threadId: last.input.threadId, turnId: last.result.turnId },
  );
  assert.equal(
    await f.scheduler.runClaimed(lease, (ctx) => coordinator.run(ctx)),
    "blocked",
  );
  assert.deepEqual(f.store.operations(f.id), ops);
  assert.equal(f.roles.filter((r) => r === "code-review").length, 2);
});
