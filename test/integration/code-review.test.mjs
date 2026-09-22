import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../../dist/store.js";
import { CodeReviewRound } from "../../dist/code-review.js";
import { PrComments } from "../../dist/pr-comments.js";
const A = "a".repeat(40),
  B = "b".repeat(40),
  C = "c".repeat(40);
function fixture(t, mode = "success") {
  const root = mkdtempSync(join(tmpdir(), "pm-code-round-")),
    store = new Store(join(root, "db"));
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const config = JSON.parse(readFileSync("config.example.json")),
    project = config.projects[0];
  store.seedProjects([project]);
  const snapshot = {
    issue: { number: 1, title: "Fixture" },
    decision: {
      contract: {
        objective: "Fix greeting",
        scope: "greeting.mjs",
        acceptance: "Trim names",
        verification: "node --test",
      },
    },
  };
  const id = store.enqueue(project.id, 1, snapshot),
    first = store.claim("implementation", 60000);
  store.operation(first, "implementation-budget", "execution-budget", {
    deadline: Date.now() + (mode === "expired" ? -100 : 60000),
  });
  store.completeOperation(first, "implementation-budget", {});
  store.operation(first, "implementation-0:thread", "thread-start", {
    role: "implementation",
  });
  store.completeOperation(first, "implementation-0:thread", {
    threadId: "implementer",
  });
  store.transition(first, "implementing");
  store.transition(first, "verifying");
  store.finishImplementation(first, 3);
  const lease = store.claimCodeReview(id, "reviewer", 60000),
    context = {
      lease,
      signal: new AbortController().signal,
      assertActive: () => store.assertWorker(lease),
    };
  const target = { head: B, base: A, commits: [B] },
    plan = {
      repository: project.repository,
      baseSha: A,
      branch: "prime-mover/test/issue-1-g0",
      cwd: root,
      bare: root,
    };
  let observations = 0;
  const published = [];
  let starts = 0,
    posts = 0,
    reads = 0,
    raw;
  const inputs = {
    collect: async () => ({
      target:
        mode === "drift" && ++reads > 1
          ? { ...target, head: C, commits: [C] }
          : target,
      diff: "combined-diff",
      commits: [{ sha: B, diff: "commit-diff" }],
    }),
  };
  const agent = {
    reuseTask: (ctx, from, key) => {
      const source = store
        .operations(id)
        .find((o) => o.key === `${from}:thread`);
      store.operation(ctx.lease, `${key}:thread`, "thread-start", source.input);
      store.completeOperation(ctx.lease, `${key}:thread`, source.result);
    },
    start: async (ctx, input) => {
      starts++;
      assert.equal(input.role, "code-review");
      assert.ok(input.outputSchema);
      assert.match(input.prompt, /combined-diff/);
      assert.match(input.prompt, /commit-diff/);
      assert.match(input.prompt, /Trim names/);
      const threadId = "independent-reviewer",
        turnId = input.key.includes("clarification")
          ? `${input.key}-turn`
          : "review-turn";
      store.operation(ctx.lease, `${input.key}:thread`, "thread-start", {
        role: "code-review",
      });
      store.completeOperation(ctx.lease, `${input.key}:thread`, { threadId });
      store.operation(ctx.lease, `${input.key}:turn`, "turn-start", {
        threadId,
      });
      store.completeOperation(ctx.lease, `${input.key}:turn`, { turnId });
      store.recordObservedTurn(ctx.lease, threadId, turnId);
      raw = JSON.stringify({
        ...target,
        verdict:
          ["finding", "empty-check", "empty-check-stubborn"].includes(mode)
            ? "changes-requested"
            : mode === "unresolved" && starts > 1
              ? "blocked"
              : "sign-off",
        checks:
          mode === "invalid"
            ? []
            : (mode === "empty-check" && starts === 1) || mode === "empty-check-stubborn"
              ? ["Inspected the actual diff", ""]
            : ["Reviewed every commit and combined diff; node --test passed"],
        limitations:
          ["clarify", "unresolved", "stubborn"].includes(mode) &&
          (starts === 1 || mode !== "clarify")
            ? ["A tooling issue required further assessment"]
            : [],
        findings:
          ["finding", "empty-check", "empty-check-stubborn"].includes(mode)
            ? [
                {
                  id: "R1-F1",
                  severity: "P1",
                  file: "greeting.mjs",
                  line: 1,
                  observed: "Untrimmed output",
                  expected: "Trimmed output",
                  acceptance: "Trim outer whitespace",
                  verification: "Whitespace regression",
                },
              ]
            : [],
        resolutions: [],
      });
      return {
        key: input.key,
        cwd: root,
        threadId,
        turnId,
        deadline: Date.now() + 10000,
        source: "fixture",
        clientId: "fixture",
      };
    },
    observe: async (ctx, run) => {
      if (mode === "approval") return "waiting";
      if (mode === "timed-out" && ++observations === 1) return "timed-out";
      store.finishTurn(ctx.lease, run.turnId);
      return mode === "failed" ? "failed" : "completed";
    },
    result: async () => raw,
  };
  const github = {
    identity: async () => "talaniz",
    comments: async () => ({ items: published, next: null }),
    comment: async (_repository, _pr, body) => {
      posts++;
      published.push({ id: "100", actor: "talaniz", body });
      if (mode === "lost" && posts === 1) throw Error("Lost report response");
      return "100";
    },
  };
  const intake = { authorize: async () => snapshot };
  const comments = new PrComments(store, github, intake.authorize);
  const round = new CodeReviewRound(
    store,
    config,
    intake,
    inputs,
    agent,
    comments,
    { pollMs: 1, approvalWaitMs: 1 },
  );
  return {
    store,
    id,
    lease,
    context,
    plan,
    project,
    round,
    get starts() {
      return starts;
    },
    get posts() {
      return posts;
    },
  };
}
test("code review round publishes attributed exact-head report once and permits gated E2E handoff", async (t) => {
  const f = fixture(t),
    report = await f.round.run(f.context, f.plan, f.project, "code-review-1");
  assert.equal(report?.verdict, "sign-off");
  assert.equal(report.taskId, "independent-reviewer");
  assert.equal(report.head, B);
  assert.match(report.reportUrl, /#issuecomment-100$/);
  assert.equal(f.posts, 1);
  assert.deepEqual(
    await f.round.run(f.context, f.plan, f.project, "code-review-1"),
    report,
  );
  assert.equal(f.starts, 1);
  assert.equal(f.posts, 1);
  f.store.finishCodeReview(f.lease);
  assert.equal(f.store.job(f.id).stage, "e2e-review");
});
for (const mode of ["invalid", "drift", "failed", "expired"])
  test(`${mode} review cannot publish a sign-off`, async (t) => {
    const f = fixture(t, mode);
    await assert.rejects(
      f.round.run(f.context, f.plan, f.project, "code-review-1"),
    );
    assert.equal(f.posts, 0);
    if (mode === "expired") assert.equal(f.starts, 0);
    assert.throws(() => f.store.finishCodeReview(f.lease));
  });
test("findings remain public and prevent E2E until triage/fixes and reviewer revalidation", async (t) => {
  const f = fixture(t, "finding"),
    report = await f.round.run(f.context, f.plan, f.project, "code-review-1");
  assert.equal(report?.findings[0].id, "R1-F1");
  assert.equal(f.posts, 1);
  assert.throws(() => f.store.finishCodeReview(f.lease), /sign.off/i);
});
test("pending review approval remains waiting with its owned turn reserved", async (t) => {
  const f = fixture(t, "approval");
  await assert.rejects(
    f.round.run(f.context, f.plan, f.project, "code-review-1"),
    /approval/i,
  );
  assert.equal(f.store.job(f.id).stage, "waiting");
  assert.equal(f.store.job(f.id).activeTurnId, "review-turn");
  assert.equal(f.posts, 0);
});

test("an observed turn timeout cannot become a successful report on the next observation", async (t) => {
  const f = fixture(t, "timed-out");
  await assert.rejects(
    f.round.run(f.context, f.plan, f.project, "code-review-1"),
    /budget|timeout|stop/i,
  );
  assert.equal(f.posts, 0);
  await assert.rejects(
    f.round.run(f.context, f.plan, f.project, "code-review-1"),
    /budget|timeout|stop/i,
  );
  assert.equal(f.posts, 0);
});
test("a lost report response resumes the persisted round and confirms one attributed comment", async (t) => {
  const f = fixture(t, "lost");
  await assert.rejects(
    f.round.run(f.context, f.plan, f.project, "code-review-1"),
    /Lost report/,
  );
  const report = await f.round.run(
    f.context,
    f.plan,
    f.project,
    "code-review-1",
  );
  assert.equal(report.verdict, "sign-off");
  assert.equal(f.posts, 1);
  assert.equal(
    f.store
      .operations(f.id)
      .filter(
        (o) => o.kind === "thread-start" && o.key.startsWith("code-review-"),
      ).length,
    1,
  );
  f.store.finishCodeReview(f.lease);
  assert.equal(f.store.job(f.id).stage, "e2e-review");
});

test("the same reviewer can clarify a resolved limitation without the coordinator dropping it", async (t) => {
  const f = fixture(t, "clarify"),
    report = await f.round.run(f.context, f.plan, f.project, "code-review-1");
  assert.equal(report.verdict, "sign-off");
  assert.equal(f.starts, 2);
  assert.equal(report.taskId, "independent-reviewer");
  assert.deepEqual(report.limitations, []);
  assert.equal(f.posts, 1);
  assert.ok(
    f.store
      .operations(f.id)
      .some((o) => o.kind === "review-report-clarification"),
  );
  f.store.finishCodeReview(f.lease);
});
test("clarification preserves unresolved limitations as a blocked public reviewer report", async (t) => {
  const f = fixture(t, "unresolved"),
    report = await f.round.run(f.context, f.plan, f.project, "code-review-1");
  assert.equal(report.verdict, "blocked");
  assert.equal(report.limitations.length, 1);
  assert.equal(f.starts, 2);
  assert.equal(f.posts, 1);
  assert.throws(() => f.store.finishCodeReview(f.lease));
});
test("contradictory sign-off clarification is bounded and never silently accepted", async (t) => {
  const f = fixture(t, "stubborn");
  await assert.rejects(
    f.round.run(f.context, f.plan, f.project, "code-review-1"),
  );
  assert.equal(f.starts, 3);
  assert.equal(f.posts, 0);
});


test("same reviewer repairs an empty check without dropping its findings", async (t) => {
  const f = fixture(t, "empty-check");
  const report = await f.round.run(f.context, f.plan, f.project, "code-review-1");
  assert.equal(report.verdict, "changes-requested");
  assert.equal(report.taskId, "independent-reviewer");
  assert.equal(report.findings[0].id, "R1-F1");
  assert.equal(f.starts, 2);
  assert.equal(f.posts, 1);
  const reason = f.store.operations(f.id).find(o => o.kind === "review-report-clarification");
  assert.ok(JSON.parse(reason.input.raw).checks.includes(""));
  assert.equal(reason.result.reason, "invalid-review-evidence");
  assert.throws(() => f.store.finishCodeReview(f.lease));
});
test("persistently empty review evidence is bounded and never published", async (t) => {
  const f = fixture(t, "empty-check-stubborn");
  await assert.rejects(f.round.run(f.context, f.plan, f.project, "code-review-1"), error => error.code === "invalid-review-report");
  assert.equal(f.starts, 3);
  assert.equal(f.posts, 0);
});
