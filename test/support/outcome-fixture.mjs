import { fixture, target } from "./review-fixture.mjs";
export function completed(t) {
  const f = fixture(t);
  f.e2e.record(f.lease, f.evidence());
  f.project.verify.forEach((argv, i) => {
    const key = `verify:${target.head}:${i}`;
    f.store.operation(f.lease, key, "verification", { argv });
    f.store.completeOperation(f.lease, key, {
      result: { status: "passed", exitCode: 0 },
      artifact: "/fixture/check",
    });
  });
  const remote = {
    ...target,
    observedAt: Date.now(),
    open: true,
    mergeable: true,
    checks: [],
    requiredChecks: [],
  };
  // A delivered notification is required by the real finishReady path.
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
  f.store.acknowledgeNotification(f.lease, n.id, "42");
  f.store.finishReady(f.lease, remote);
  const outcome = {
    repository: f.project.repository,
    number: 3,
    head: target.head,
    baseBranch: f.project.baseBranch,
    state: "merged",
    mergedAt: new Date().toISOString(),
    mergeCommit: "c".repeat(40),
    observedAt: Date.now(),
  };
  return { ...f, remote, payload, n, outcome };
}
