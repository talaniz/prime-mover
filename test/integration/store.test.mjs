import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";
const projects = JSON.parse(readFileSync("config.example.json")).projects;
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "pm-store-"));
  const filename = join(dir, "jobs.db");
  let now = 1000;
  const stores = [];
  const open = () => {
    const s = new Store(filename, () => now);
    stores.push(s);
    return s;
  };
  const a = open();
  a.seedProjects(projects);
  t.after(() => {
    for (const s of stores) s.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { a, open, filename, setTime: (n) => (now = n) };
}
test("migrations and project seeds preserve identity, settings and jobs across reopen", (t) => {
  const { a, open } = setup(t);
  a.setProjectEnabled("doom-dashboard", false);
  const id = a.enqueue("prime-mover", 1, { objective: "test" });
  const b = open();
  b.seedProjects(projects);
  assert.equal(b.projects().length, 2);
  assert.equal(
    b.projects().find((p) => p.id === "doom-dashboard").enabled,
    false,
  );
  assert.equal(b.job(id).snapshot.objective, "test");
});
test("same issue numbers across repositories differ and repeats are idempotent", (t) => {
  const { a } = setup(t);
  const x = a.enqueue("prime-mover", 1, {});
  const y = a.enqueue("doom-dashboard", 1, {});
  assert.notEqual(x, y);
  assert.equal(a.enqueue("prime-mover", 1, {}), x);
  assert.equal(a.jobs().length, 2);
  assert.throws(() => a.enqueue("prime-mover", 1, {}, 1), /active generation/);
});
test("two connections cannot claim two jobs across projects", (t) => {
  const { a, open } = setup(t);
  a.enqueue("prime-mover", 1, {});
  a.enqueue("doom-dashboard", 2, {});
  const b = open();
  const lease = a.claim("one", 100);
  assert.ok(lease);
  assert.equal(b.claim("two", 100), null);
  assert.equal(a.job(lease.jobId).stage, "preparing");
});
test("lease expiry fences all worker mutation and does not release remote ownership", (t) => {
  const { a, open, setTime } = setup(t);
  a.enqueue("prime-mover", 1, {});
  a.enqueue("doom-dashboard", 2, {});
  const lease = a.claim("one", 100);
  setTime(1101);
  assert.throws(() => a.heartbeat(lease, 100), /lease/);
  assert.throws(() => a.transition(lease, "implementing"), /lease/);
  assert.throws(() => a.operation(lease, "start", "turn", {}), /lease/);
  assert.equal(open().claim("two", 100), null);
});
test("invalid stage jumps fail; transition and heartbeat are durable", (t) => {
  const { a, open, setTime } = setup(t);
  a.enqueue("prime-mover", 1, {});
  const lease = a.claim("one", 100);
  assert.throws(() => a.transition(lease, "ready"), /transition/);
  a.transition(lease, "implementing");
  setTime(1050);
  a.heartbeat(lease, 200);
  assert.equal(open().job(lease.jobId).leaseUntil, 1250);
  assert.equal(a.job(lease.jobId).stage, "implementing");
});
test("global turn guard and matching completion prevent hidden active work", (t) => {
  const { a } = setup(t);
  a.enqueue("prime-mover", 1, {});
  const lease = a.claim("one", 100);
  a.beginTurn(lease, "thread", "turn");
  assert.throws(() => a.beginTurn(lease, "thread", "another"), /active turn/);
  assert.throws(() => a.finishTurn(lease, "wrong"), /turn/);
  assert.throws(() => a.blockAndRelease(lease, "operator"), /active turn/);
  a.finishTurn(lease, "turn");
  a.blockAndRelease(lease, "operator");
  assert.equal(a.job(lease.jobId).leaseOwner, null);
});
test("external operation intent is durable and immutable, result completion idempotent", (t) => {
  const { a, open } = setup(t);
  a.enqueue("prime-mover", 1, {});
  const lease = a.claim("one", 100);
  const first = a.operation(lease, "create-pr", "github-pr", {
    branch: "job/1",
  });
  assert.equal(first.status, "pending");
  assert.equal(open().operations(lease.jobId)[0].status, "pending");
  assert.throws(
    () => a.operation(lease, "create-pr", "github-pr", { branch: "other" }),
    /intent/,
  );
  a.completeOperation(lease, "create-pr", { number: 4 });
  a.completeOperation(lease, "create-pr", { number: 4 });
  assert.equal(open().operations(lease.jobId)[0].status, "done");
  assert.throws(
    () => a.completeOperation(lease, "create-pr", { number: 5 }),
    /result/,
  );
});
test("pause survives reopen and prevents claims without dropping work", (t) => {
  const { a, open } = setup(t);
  a.enqueue("prime-mover", 1, {});
  a.setPaused(true);
  const b = open();
  assert.equal(b.paused(), true);
  assert.equal(b.claim("worker", 100), null);
  b.setPaused(false);
  assert.ok(a.claim("worker", 100));
});
test("cancel queued job is durable; active job cancellation is a request until reconciled", (t) => {
  const { a, open } = setup(t);
  const id = a.enqueue("prime-mover", 1, {});
  a.cancel(id, "operator requested");
  assert.equal(open().job(id).stage, "cancelled");
  const id2 = a.enqueue("doom-dashboard", 2, {});
  const lease = a.claim("worker", 100);
  a.beginTurn(lease, "thread", "turn");
  a.cancel(id2, "operator requested");
  assert.equal(a.job(id2).cancelRequested, true);
  assert.notEqual(a.job(id2).stage, "cancelled");
});
test("blocked retry requires reason, reconciled operations and no lease/active turn", (t) => {
  const { a } = setup(t);
  const id = a.enqueue("prime-mover", 1, {});
  const lease = a.claim("worker", 100);
  a.operation(lease, "start", "turn", {});
  a.blockAndRelease(lease, "external-state-unknown");
  assert.throws(() => a.retryBlocked(id, ""), /reason/);
  assert.throws(() => a.retryBlocked(id, "retry request"), /reconcil/);
});
test("safe blocked retry is auditable and preserves generation and budget counters", (t) => {
  const { a, open } = setup(t);
  const id = a.enqueue("prime-mover", 1, {});
  const lease = a.claim("worker", 100);
  a.blockAndRelease(lease, "operator");
  a.retryBlocked(id, "configuration corrected");
  assert.equal(open().job(id).stage, "queued");
  assert.equal(a.job(id).generation, 0);
  assert.equal(a.job(id).attempts, 1);
  assert.ok(a.events(id).some((e) => e.kind === "operator-retry"));
});
test("retry deadline survives reopen and cannot be claimed early", (t) => {
  const { a, open, setTime } = setup(t);
  const id = a.enqueue("prime-mover", 1, {});
  const lease = a.claim("one", 100);
  a.scheduleRetry(lease, 2000);
  const b = open();
  setTime(1999);
  assert.equal(b.claim("two", 100), null);
  setTime(2000);
  assert.equal(b.claim("two", 100).jobId, id);
});
test("budget usage is persistent and rejects exhaustion", (t) => {
  const { a, open } = setup(t);
  a.enqueue("prime-mover", 1, {});
  const lease = a.claim("one", 100);
  assert.equal(a.consumeBudget(lease, "transport", 2), 1);
  assert.equal(open().consumeBudget(lease, "transport", 2), 2);
  assert.throws(() => a.consumeBudget(lease, "transport", 2), /budget/);
});
test("notification intent persists and acknowledgment is idempotent", (t) => {
  const { a, open } = setup(t);
  const id = a.enqueue("prime-mover", 1, {});
  const lease = a.claim("one", 100);
  const n = a.notification(lease, "ready:head1", { marker: "notification-1" });
  assert.ok(n?.id);
  assert.equal(open().notifications(id)[0].status, "pending");
  assert.equal(
    a.notification(lease, "ready:head1", { marker: "notification-1" }).id,
    n.id,
  );
  a.acknowledgeNotification(lease, n.id, "comment-1");
  assert.equal(open().notifications(id)[0].remoteId, "comment-1");
  assert.throws(
    () => a.acknowledgeNotification(lease, n.id, "comment-2"),
    /notification/,
  );
});
test("active cancellation reaches terminal state only after turn and side effects reconcile", (t) => {
  const { a } = setup(t);
  const id = a.enqueue("prime-mover", 1, {});
  const lease = a.claim("one", 100);
  a.beginTurn(lease, "thread", "turn");
  a.cancel(id, "stop");
  assert.throws(() => a.completeCancellation(lease), /reconcil/);
  a.finishTurn(lease, "turn");
  a.completeCancellation(lease);
  assert.equal(a.job(id).stage, "cancelled");
  assert.equal(a.job(id).leaseOwner, null);
});
test("pending notification blocks another job and operator retry until reconciled", (t) => {
  const { a } = setup(t);
  a.enqueue("prime-mover", 1, {});
  a.enqueue("doom-dashboard", 2, {});
  const lease = a.claim("one", 100);
  a.notification(lease, "ready:head", { marker: "ready" });
  a.blockAndRelease(lease, "external-state-unknown");
  assert.equal(a.claim("two", 100), null);
  assert.throws(() => a.retryBlocked(lease.jobId, "try again"), /reconcil/);
});
test("cancellation prevents creating new external-operation intents", (t) => {
  const { a } = setup(t);
  const id = a.enqueue("prime-mover", 1, {});
  const lease = a.claim("one", 100);
  a.cancel(id, "stop");
  assert.throws(() => a.operation(lease, "new-turn", "turn", {}), /cancel/i);
});
test("schema one upgrade preserves jobs, append-only events and operator pause", async (t) => {
  const { a, filename, open } = setup(t);
  const id = a.enqueue("prime-mover", 42, {
    objective: "Existing version one job",
  });
  a.setPaused(true);
  a.close();
  const { DatabaseSync } = await import("node:sqlite");
  const old = new DatabaseSync(filename);
  old.exec(
    "DROP TABLE intake_acks; DROP TABLE intake_polls; ALTER TABLE jobs DROP COLUMN intake_invalid; PRAGMA user_version=1;",
  );
  old.close();
  const upgraded = open();
  assert.equal(upgraded.paused(), true);
  assert.equal(upgraded.job(id).snapshot.objective, "Existing version one job");
  assert.equal(upgraded.events(id).length, 1);
  assert.deepEqual(upgraded.pollState("prime-mover"), {
    nextAt: 0,
    failures: 0,
  });
});
