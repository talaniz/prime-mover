import test from "node:test";
import assert from "node:assert/strict";
import { fixture, target } from "../support/review-fixture.mjs";
test("ready transition rejects code-only review even with no active turn", (t) => {
  const f = fixture(t);
  assert.throws(
    () => f.store.transition(f.lease, "ready"),
    /readiness|e2e|evidence/i,
  );
  assert.equal(f.store.job(f.id).stage, "e2e-review");
});
test("E2E evidence is stored separately and requires a third independent task", (t) => {
  const f = fixture(t);
  f.e2e.record(f.lease, f.evidence());
  assert.equal(
    f.store.operations(f.id).filter((o) => o.kind === "e2e-review-report")
      .length,
    1,
  );
  assert.equal(
    f.reviews.requireCodeSignoff(f.id, target).taskId,
    "code-review",
  );
  for (const taskId of ["code-review", "implementation"])
    assert.throws(
      () => f.e2e.record(f.lease, f.evidence({ taskId })),
      /independent|role|identity/i,
    );
});
test("source-only checks and unresolved workflow failures cannot satisfy E2E", (t) => {
  const f = fixture(t);
  for (const change of [
    { workflows: [] },
    { acceptance: "Different contract" },
    { workflows: f.evidence().workflows.slice(0, 1) },
    { workflows: f.evidence().workflows.map((w) => ({ ...w, passed: false })) },
    { limitations: ["Environment unavailable"] },
  ])
    assert.throws(
      () => f.e2e.record(f.lease, f.evidence(change)),
      /workflow|acceptance|evidence|sign.off/i,
    );
  f.e2e.record(f.lease, f.evidence());
});
test("a changed head requires code re-review before any new E2E sign-off", (t) => {
  const f = fixture(t);
  f.e2e.record(f.lease, f.evidence());
  const next = {
    ...target,
    head: "c".repeat(40),
    commits: [...target.commits, "c".repeat(40)],
  };
  f.reviews.bind(f.lease, next);
  f.task("e2e-review", 2);
  assert.throws(
    () =>
      f.e2e.record(f.lease, f.evidence({ ...next, turnId: "e2e-review-2" })),
    /code.review|sign.off/i,
  );
});

test("code re-review cannot reuse the E2E reviewer identity under a different role key", (t) => {
  const f = fixture(t);
  f.e2e.record(f.lease, f.evidence());
  f.task("code-review", 2, "e2e-review");
  assert.throws(
    () =>
      f.reviews.record(
        f.lease,
        f.report("code-review", {
          taskId: "e2e-review",
          turnId: "code-review-2",
          reportUrl:
            "https://github.com/talaniz/prime-mover/pull/3#issuecomment-3",
        }),
      ),
    /independent|role/i,
  );
});
