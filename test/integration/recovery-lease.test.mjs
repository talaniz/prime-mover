import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pm-recovery-"));
  let now = 1000;
  const file = join(root, "db"),
    store = new Store(file, () => now);
  store.seedProjects(JSON.parse(readFileSync("config.example.json")).projects);
  const id = store.enqueue("prime-mover", 1, {}),
    lease = store.claim("old", 100);
  store.operation(lease, "implementation-budget", "execution-budget", {
    deadline: 10000,
  });
  store.completeOperation(lease, "implementation-budget", {});
  store.transition(lease, "implementing");
  store.operation(lease, "implementation-0:thread", "thread-start", {
    role: "implementation",
    source: "owned",
    cwd: "/isolated",
  });
  store.completeOperation(lease, "implementation-0:thread", {
    threadId: "task",
  });
  store.beginTurn(lease, "task", "turn");
  store.operation(lease, "pending-send", "turn-start", {
    clientId: "persisted-id",
  });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, id, lease, file, time: (n) => (now = n) };
}
test("recovery refuses live ownership and adopts expired ownership without erasing the remote reservation or intent", (t) => {
  const f = fixture(t);
  assert.throws(
    () => f.store.claimRecovery(f.id, "new", 1000),
    /live|lease|expired/i,
  );
  f.time(1101);
  const ops = f.store.operations(f.id),
    lease = f.store.claimRecovery(f.id, "new", 1000);
  assert.equal(lease.epoch, f.lease.epoch + 1);
  assert.equal(f.store.job(f.id).activeTurnId, "turn");
  assert.equal(f.store.job(f.id).activeThreadId, "task");
  assert.deepEqual(f.store.operations(f.id), ops);
  assert.throws(
    () => f.store.completeOperation(f.lease, "pending-send", {}),
    /lease/i,
  );
  assert.equal(f.store.claim("competing", 1000), null);
});
test("recovery continuation retains the original deadline and consumes a durable bounded restart budget", (t) => {
  const f = fixture(t);
  f.time(1101);
  let lease = f.store.claimRecovery(f.id, "new", 100);
  f.store.resumeRecovery(lease, "preparing", 1);
  assert.equal(f.store.job(f.id).activeTurnId, "turn");
  assert.equal(
    f.store.operations(f.id).find((o) => o.key === "implementation-budget")
      .input.deadline,
    10000,
  );
  f.time(1202);
  lease = f.store.claimRecovery(f.id, "third", 100);
  assert.throws(() => f.store.resumeRecovery(lease, "preparing", 1), /budget/i);
  assert.equal(f.store.job(f.id).activeTurnId, "turn");
});
test("expired execution may be adopted for observation but never resumed for further work", (t) => {
  const f = fixture(t);
  f.time(11000);
  const lease = f.store.claimRecovery(f.id, "stopper", 100);
  assert.throws(
    () => f.store.resumeRecovery(lease, "preparing", 3),
    /budget|deadline/i,
  );
  assert.equal(f.store.job(f.id).activeTurnId, "turn");
});
test("cancelled work may be adopted to reconcile its exact turn but cannot restart execution", (t) => {
  const f = fixture(t);
  f.store.cancel(f.id, "stop");
  f.time(1101);
  const lease = f.store.claimRecovery(f.id, "stopper", 100);
  assert.throws(() => f.store.resumeRecovery(lease, "preparing", 3), /cancel/i);
  assert.equal(f.store.job(f.id).cancelRequested, true);
  assert.equal(f.store.job(f.id).activeTurnId, "turn");
});

function unstarted(t) {
  const root = mkdtempSync(join(tmpdir(), "pm-before-intent-"));
  let now = 1000;
  const store = new Store(join(root, "db"), () => now);
  store.seedProjects(JSON.parse(readFileSync("config.example.json")).projects);
  const id = store.enqueue("prime-mover", 1, {});
  store.claim("crashed", 100);
  now = 1500;
  const lease = store.claimRecovery(id, "recovery", 1000);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, id, lease, time: (n) => (now = n) };
}
test("crash before the first intent reconstructs deadline from the original claim rather than restart time", (t) => {
  const f = unstarted(t);
  assert.equal(f.store.recoverExecutionBudget(f.lease, 2), 3000);
  f.store.resumeRecovery(f.lease, "preparing", 2);
  assert.equal(f.store.recoverExecutionBudget(f.lease, 200), 3000);
  assert.equal(f.store.operations(f.id)[0].input.deadline, 3000);
});
test("reconstructing a missing budget cannot extend expired work or conceal prior side effects", (t) => {
  const f = unstarted(t);
  f.time(2200);
  assert.throws(
    () => f.store.recoverExecutionBudget(f.lease, 1),
    /budget|deadline/i,
  );
  assert.deepEqual(f.store.operations(f.id), []);
  f.store.operation(f.lease, "uncertain-send", "thread-start", {});
  assert.throws(
    () => f.store.recoverExecutionBudget(f.lease, 10),
    /intent|reconcil|missing/i,
  );
  assert.equal(f.store.operations(f.id).length, 1);
});
