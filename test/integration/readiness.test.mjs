import test from "node:test";
import assert from "node:assert/strict";
import { fixture, target } from "../support/review-fixture.mjs";
function readyFixture(t, budgetMs) {
  const f = fixture(t, budgetMs);
  f.e2e.record(f.lease, f.evidence());
  const checks = f.project.verify.map((argv, i) => {
    const key = `verify:${target.head}:${i}`;
    f.store.operation(f.lease, key, "verification", { argv });
    f.store.completeOperation(f.lease, key, {
      result: { status: "passed", exitCode: 0 },
      artifact: "/private/check.json",
    });
    return argv;
  });
  const payload = {
    ...target,
    codeReview: f.report("code-review").reportUrl,
    e2eReview: f.evidence().reportUrl,
  };
  const n = f.store.notification(
    f.lease,
    `ready:${target.head}:${target.base}`,
    payload,
  );
  f.store.acknowledgeNotification(f.lease, n.id, "3");
  const remote = {
    ...target,
    observedAt: Date.now(),
    open: true,
    mergeable: true,
    checks: [],
    requiredChecks: [],
  };
  return { ...f, remote, checks };
}
test("readiness requires current reviews, configured verification and delivered notification, then releases the lease", (t) => {
  const f = readyFixture(t);
  f.store.finishReady(f.lease, f.remote);
  assert.equal(f.store.job(f.id).stage, "ready");
  assert.equal(f.store.job(f.id).leaseOwner, null);
  assert.equal(
    f.store.operations(f.id).filter((o) => o.kind === "readiness-evidence")
      .length,
    1,
  );
});
for (const [name, change] of Object.entries({
  head: { head: "c".repeat(40) },
  base: { base: "c".repeat(40) },
  closed: { open: false },
  conflict: { mergeable: false },
  unknown: { mergeable: null },
  stale: { observedAt: Date.now() - 60000 },
  future: { observedAt: Date.now() + 60000 },
  failed: {
    checks: [
      {
        name: "ci",
        head: target.head,
        status: "failure",
        url: "https://github.com/o/r/actions/runs/1",
      },
    ],
  },
  pending: {
    checks: [
      {
        name: "ci",
        head: target.head,
        status: "pending",
        url: "https://github.com/o/r/actions/runs/1",
      },
    ],
  },
  missingRequired: { requiredChecks: ["ci"] },
  wrongCheckHead: {
    requiredChecks: ["ci"],
    checks: [
      {
        name: "ci",
        head: "c".repeat(40),
        status: "success",
        url: "https://github.com/o/r/actions/runs/1",
      },
    ],
  },
}))
  test(`readiness refuses ${name} remote evidence`, (t) => {
    const f = readyFixture(t);
    assert.throws(
      () => f.store.finishReady(f.lease, { ...f.remote, ...change }),
      /readiness|check|head|base|fresh|conflict|open/i,
    );
    assert.equal(f.store.job(f.id).stage, "e2e-review");
  });
test("readiness requires configured checks even when GitHub declares none", (t) => {
  const f = readyFixture(t);
  f.store.seedProjects([{ ...f.project, requiredChecks: ["ci"] }]);
  assert.throws(() => f.store.finishReady(f.lease, f.remote), /check/i);
});
test("unverified commands or undelivered notification cannot mark ready", (t) => {
  const f = fixture(t);
  f.e2e.record(f.lease, f.evidence());
  assert.throws(
    () =>
      f.store.finishReady(f.lease, {
        ...target,
        observedAt: Date.now(),
        open: true,
        mergeable: true,
        checks: [],
        requiredChecks: [],
      }),
    /verification|notification/i,
  );
});
test("readiness can be revoked without deleting review evidence or notifying twice", (t) => {
  const f = readyFixture(t);
  f.store.finishReady(f.lease, f.remote);
  f.store.revokeReadiness(f.id, "required-check-failed");
  assert.equal(f.store.job(f.id).stage, "blocked");
  assert.equal(f.store.job(f.id).blockCode, "required-check-failed");
  assert.equal(f.store.notifications(f.id).length, 1);
  assert.equal(f.e2e.requireSignoff(f.id, target).head, target.head);
});

test("expired execution budget cannot become a fresh readiness result", (t) => {
  const f = readyFixture(t, -1);
  assert.throws(
    () => f.store.finishReady(f.lease, f.remote),
    /budget|deadline/i,
  );
  assert.equal(f.store.job(f.id).stage, "e2e-review");
});
test("required integration checks reject an untrusted app with the same context name", (t) => {
  const f = readyFixture(t);
  const remote = {
    ...f.remote,
    requiredChecks: ["ci"],
    requiredApps: [{ name: "ci", appId: 123 }],
    checks: [
      {
        name: "ci",
        appId: 456,
        head: target.head,
        status: "success",
        url: "https://github.com/talaniz/prime-mover/actions/runs/1",
      },
    ],
  };
  assert.throws(() => f.store.finishReady(f.lease, remote), /app identity/i);
  f.store.finishReady(f.lease, {
    ...remote,
    checks: remote.checks.map((c) => ({ ...c, appId: 123 })),
  });
  assert.equal(f.store.job(f.id).stage, "ready");
});
