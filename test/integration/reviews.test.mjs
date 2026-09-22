import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";
import { Reviews } from "../../dist/reviews.js";
const A = "a".repeat(40),
  B = "b".repeat(40),
  C = "c".repeat(40);
const target = { head: B, base: A, commits: [B] };
function fixture(t, reviewerRole = "code-review") {
  const root = mkdtempSync(join(tmpdir(), "pm-reviews-"));
  const db = join(root, "db");
  const store = new Store(db);
  const p = JSON.parse(readFileSync("config.example.json")).projects[0];
  store.seedProjects([p]);
  const id = store.enqueue(p.id, 1, {});
  let lease = store.claim("reviewer", 60000);
  store.operation(lease, "implementation-0:thread", "thread-start", {
    cwd: "/isolated",
    source: "fixture",
  });
  store.completeOperation(lease, "implementation-0:thread", {
    threadId: "implementer",
  });
  for (const stage of ["implementing", "verifying"])
    store.transition(lease, stage);
  store.finishImplementation(lease, 1);
  lease = store.claimCodeReview(id, "reviewer", 60000);
  store.operation(lease, "code-review-1:thread", "thread-start", {
    cwd: "/isolated",
    source: "review-fixture",
    role: reviewerRole,
  });
  store.completeOperation(lease, "code-review-1:thread", {
    threadId: "independent-code-reviewer",
  });
  for (const [key, turnId] of [
    ["code-review-1:turn", "review-turn"],
    ["code-review-2:turn", "review-turn-2"],
  ]) {
    store.operation(lease, key, "turn-start", {
      threadId: "independent-code-reviewer",
    });
    store.completeOperation(lease, key, { turnId });
    store.recordObservedTurn(lease, "independent-code-reviewer", turnId);
    store.finishTurn(lease, turnId);
  }
  const reviews = new Reviews(store);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    id,
    lease,
    reviews,
    db,
    report: (overrides = {}) => ({
      head: B,
      base: A,
      commits: [B],
      taskId: "independent-code-reviewer",
      turnId: "review-turn",
      reportUrl: `https://github.com/${p.repository}/pull/1#issuecomment-100`,
      verdict: "sign-off",
      checks: ["Inspected every commit and aggregate diff; node --test passed"],
      limitations: [],
      findings: [],
      resolutions: [],
      ...overrides,
    }),
  };
}
test("code sign-off requires persisted current-head independent complete review evidence", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  assert.throws(
    () => f.reviews.requireCodeSignoff(f.id, target),
    /sign.off|review/i,
  );
  f.reviews.record(f.lease, f.report());
  assert.equal(
    f.reviews.requireCodeSignoff(f.id, target).taskId,
    "independent-code-reviewer",
  );
  const reopened = new Store(f.db);
  try {
    assert.equal(
      new Reviews(reopened).requireCodeSignoff(f.id, target).head,
      B,
    );
  } finally {
    reopened.close();
  }
});
test("stale head, base, incomplete commit coverage and implementer identity cannot sign off", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  for (const change of [
    { head: C },
    { base: C },
    { commits: [] },
    { taskId: "implementer" },
    { reportUrl: "" },
    { checks: [] },
    { limitations: ["Could not inspect commits"] },
  ])
    assert.throws(
      () => f.reviews.record(f.lease, f.report(change)),
      /review|head|coverage|independent|evidence|sign.off/i,
    );
});
test("a changed head invalidates old sign-off and prevents E2E entry", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  f.reviews.record(f.lease, f.report());
  f.reviews.bind(f.lease, { head: C, base: A, commits: [B, C] });
  assert.throws(
    () =>
      f.reviews.requireCodeSignoff(f.id, { head: C, base: A, commits: [B, C] }),
    /sign.off|review/i,
  );
  assert.throws(
    () => f.store.transition(f.lease, "e2e-review"),
    /sign.off|review/i,
  );
});
test("the state machine refuses E2E before any independent sign-off", (t) => {
  const f = fixture(t);
  assert.throws(
    () => f.store.transition(f.lease, "e2e-review"),
    /sign.off|review/i,
  );
});
const finding = {
  id: "F1",
  severity: "P1",
  file: "greeting.mjs",
  line: 2,
  observed: "Whitespace-only input accepted",
  expected: "Reject whitespace-only input",
  acceptance: "Whitespace-only input throws TypeError",
  verification: "Add and run whitespace-only regression",
};
test("accepted findings require contract, public triage and reviewer-confirmed resolution", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  f.reviews.record(
    f.lease,
    f.report({ verdict: "changes-requested", findings: [finding] }),
  );
  const disposition = {
    findingId: "F1",
    decision: "accepted",
    reason: "Reproduced contract violation",
    replyUrl: "https://github.com/talaniz/prime-mover/pull/1#issuecomment-101",
    acceptance: finding.acceptance,
    verification: finding.verification,
  };
  assert.throws(
    () => f.reviews.triage(f.lease, { ...disposition, acceptance: "" }),
    /contract|acceptance/i,
  );
  f.reviews.triage(f.lease, disposition);
  assert.throws(
    () =>
      f.reviews.record(
        f.lease,
        f.report({
          turnId: "review-turn-2",
          reportUrl:
            "https://github.com/talaniz/prime-mover/pull/1#issuecomment-102",
        }),
      ),
    /unresolved|resolution/i,
  );
  f.reviews.record(
    f.lease,
    f.report({
      turnId: "review-turn-2",
      reportUrl:
        "https://github.com/talaniz/prime-mover/pull/1#issuecomment-102",
      resolutions: [
        {
          findingId: "F1",
          decision: "resolved",
          reason: "Verified regression and implementation",
        },
      ],
    }),
  );
  assert.equal(f.reviews.requireCodeSignoff(f.id, target).verdict, "sign-off");
});
test("rejected/deferred findings retain public rationale and disputed findings block sign-off", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  f.reviews.record(
    f.lease,
    f.report({ verdict: "changes-requested", findings: [finding] }),
  );
  assert.throws(
    () =>
      f.reviews.triage(f.lease, {
        findingId: "F1",
        decision: "rejected",
        reason: "",
        replyUrl: "",
        acceptance: "",
        verification: "",
      }),
    /rationale|reason|evidence/i,
  );
  f.reviews.triage(f.lease, {
    findingId: "F1",
    decision: "deferred",
    reason: "Outside requested scope; tracked in issue #2",
    replyUrl: "https://github.com/talaniz/prime-mover/pull/1#issuecomment-101",
    acceptance: "",
    verification: "",
  });
  assert.throws(
    () =>
      f.reviews.record(
        f.lease,
        f.report({
          turnId: "review-turn-2",
          resolutions: [
            {
              findingId: "F1",
              decision: "disputed",
              reason: "Still required by acceptance contract",
            },
          ],
        }),
      ),
    /unresolved|disput/i,
  );
});
test("moving away from a signed head and back requires explicit reviewer revalidation", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  f.reviews.record(f.lease, f.report());
  f.reviews.bind(f.lease, { head: C, base: A, commits: [B, C] });
  f.reviews.bind(f.lease, target);
  assert.throws(
    () => f.reviews.requireCodeSignoff(f.id, target),
    /sign.off|review/i,
  );
});

test("an unrecorded reviewer task or turn cannot supply sign-off evidence", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  for (const change of [{ taskId: "unknown-task" }, { turnId: "unknown-turn" }])
    assert.throws(
      () => f.reviews.record(f.lease, f.report(change)),
      /owned|recorded|identity/i,
    );
});

test("an implementation task disguised with a review key is still not an independent reviewer", (t) => {
  const f = fixture(t, "implementation");
  f.reviews.bind(f.lease, target);
  assert.throws(
    () => f.reviews.record(f.lease, f.report()),
    /independent|role/i,
  );
});
test("correction cycles require accepted contracts and preserve their budget across retries and reopen", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  assert.throws(
    () => f.reviews.reserveCorrection(f.lease, "fix-1", 2),
    /accepted|contract/i,
  );
  f.reviews.record(
    f.lease,
    f.report({ verdict: "changes-requested", findings: [finding] }),
  );
  f.reviews.triage(f.lease, {
    findingId: "F1",
    decision: "accepted",
    reason: "Reproduced",
    replyUrl: "https://github.com/talaniz/prime-mover/pull/1#issuecomment-101",
    acceptance: finding.acceptance,
    verification: finding.verification,
  });
  assert.equal(f.reviews.reserveCorrection(f.lease, "fix-1", 2), 1);
  assert.equal(f.reviews.reserveCorrection(f.lease, "fix-1", 2), 1);
  const reopened = new Store(f.db);
  try {
    const reviews = new Reviews(reopened);
    assert.equal(reviews.reserveCorrection(f.lease, "fix-2", 2), 2);
    assert.throws(
      () => reviews.reserveCorrection(f.lease, "fix-3", 2),
      /budget/i,
    );
  } finally {
    reopened.close();
  }
});

test("review claims serialize globally and require a published reconciled implementation", (t) => {
  const f = fixture(t);
  assert.throws(
    () => f.store.claimCodeReview(f.id, "next-reviewer", 60000),
    /reservation|published|claim/i,
  );
  const other = f.store.enqueue(f.store.projects()[0].id, 2, {});
  assert.throws(
    () => f.store.claimCodeReview(other, "next-reviewer", 60000),
    /published|claim/i,
  );
});

test("published jobs can be claimed for review and only current sign-off releases them to E2E", (t) => {
  const root = mkdtempSync(join(tmpdir(), "pm-review-claim-")),
    store = new Store(join(root, "db"));
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const p = JSON.parse(readFileSync("config.example.json")).projects[0];
  store.seedProjects([p]);
  const id = store.enqueue(p.id, 12, {}),
    implementation = store.claim("implementer", 60000);
  store.transition(implementation, "implementing");
  store.transition(implementation, "verifying");
  store.finishImplementation(implementation, 3);
  const lease = store.claimCodeReview(id, "reviewer", 60000),
    reviews = new Reviews(store);
  assert.equal(store.job(id).stage, "code-review");
  assert.equal(lease.epoch, implementation.epoch + 1);
  reviews.bind(lease, target);
  assert.throws(() => store.finishCodeReview(lease), /sign.off|review/i);
  store.operation(lease, "code-review-1:thread", "thread-start", {
    role: "code-review",
  });
  store.completeOperation(lease, "code-review-1:thread", {
    threadId: "reviewer-task",
  });
  store.operation(lease, "code-review-1:turn", "turn-start", {
    threadId: "reviewer-task",
  });
  store.completeOperation(lease, "code-review-1:turn", {
    turnId: "reviewer-turn",
  });
  reviews.record(lease, {
    ...target,
    taskId: "reviewer-task",
    turnId: "reviewer-turn",
    reportUrl: `https://github.com/${p.repository}/pull/3#issuecomment-1`,
    verdict: "sign-off",
    checks: ["Inspected every commit and combined diff"],
    limitations: [],
    findings: [],
    resolutions: [],
  });
  store.beginTurn(lease, "reviewer-task", "another-turn");
  assert.throws(() => store.finishCodeReview(lease), /active|reconcil/i);
  assert.throws(
    () => store.transition(lease, "e2e-review"),
    /active|reconcil/i,
  );
  store.finishTurn(lease, "another-turn");
  store.finishCodeReview(lease);
  assert.equal(store.job(id).stage, "e2e-review");
  assert.equal(store.job(id).leaseOwner, null);
});

test("prepublication validation rejects invalid sign-off before any report is recorded", (t) => {
  const f = fixture(t);
  f.reviews.bind(f.lease, target);
  const { reportUrl, ...draft } = f.report();
  const count = f.store.operations(f.id).length;
  assert.doesNotThrow(() => f.reviews.validate(f.lease, draft));
  for (const change of [
    { head: C },
    { commits: [] },
    { taskId: "implementer" },
    { checks: [] },
    { limitations: ["Repository inaccessible"] },
  ])
    assert.throws(
      () => f.reviews.validate(f.lease, { ...draft, ...change }),
      /review|sign.off|independent|coverage/i,
    );
  assert.equal(f.store.operations(f.id).length, count);
});

test("explicit review continuation requires exact completed-task proof and preserves round intents", (t) => {
  const f = fixture(t);
  f.store.operation(f.lease, "code-review-1:round", "code-review-round", {
    head: B,
  });
  const budget = { deadline: Date.now() + 60000 };
  f.store.operation(f.lease, "implementation-budget", "execution-budget", budget);
  f.store.completeOperation(f.lease, "implementation-budget", budget);
  for (let i = 0; i < 3; i++) f.store.consumeBudget(f.lease, "recovery-attempts", 3);
  const original = f.store.operations(f.id);
  f.store.blockAndRelease(f.lease, "recovery-attempt-budget-exhausted");
  const proof = {
    threadId: "independent-code-reviewer",
    turnId: "review-turn-2",
  };
  assert.throws(
    () =>
      f.store.reclaimCodeReview(
        f.id,
        "operator",
        60000,
        "clarify completed report",
        { ...proof, threadId: "wrong" },
      ),
    /proof|reconcil/i,
  );
  const next = f.store.reclaimCodeReview(
    f.id,
    "operator",
    60000,
    "clarify completed report",
    proof,
  );
  assert.equal(f.store.budgetUsed(f.id, "recovery-attempts"), 3);
  assert.deepEqual(f.store.operations(f.id), original);
  assert.equal(next.epoch, f.lease.epoch + 1);
  assert.equal(f.store.job(f.id).stage, "code-review");
  assert.equal(
    f.store.operations(f.id).find((o) => o.key === "code-review-1:round")
      .status,
    "pending",
  );
});
