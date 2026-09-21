import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";

async function fixture(t) {
  const { StartupRecovery } = await import("../../dist/startup-recovery.js");
  let now = 1000;
  const root = mkdtempSync(join(tmpdir(), "pm-startup-"));
  const store = new Store(join(root, "db"), () => now);
  store.seedProjects(JSON.parse(readFileSync("config.example.json")).projects);
  const id = store.enqueue("prime-mover", 1, {}),
    lease = store.claim("crashed", 100);
  const calls = [];
  const agent = {
    async reconcileRecorded(context, key) {
      calls.push(["reconcile", key]);
      return { key };
    },
    async observe(context) {
      calls.push(["observe", context.signal.aborted]);
      store.finishTurn(context.lease, "turn");
      return "completed";
    },
  };
  const intake = {
    async authorize() {
      calls.push(["authorize"]);
    },
  };
  const recovery = (options = {}) =>
    new StartupRecovery(
      store,
      {
        jobSeconds: 10,
        recoveryAttempts: 2,
        leaseMs: 1000,
        stopWaitMs: 10,
        pollMs: 1,
        now: () => now,
        ...options,
      },
      agent,
      intake,
    );
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    id,
    lease,
    calls,
    agent,
    intake,
    recovery,
    time: (n) => (now = n),
  };
}
function turn(f) {
  f.store.operation(f.lease, "implementation-budget", "execution-budget", {
    deadline: 10000,
  });
  f.store.completeOperation(f.lease, "implementation-budget", {
    deadline: 10000,
  });
  f.store.operation(f.lease, "implementation-0:thread", "thread-start", {});
  f.store.completeOperation(f.lease, "implementation-0:thread", {
    threadId: "task",
  });
  f.store.operation(f.lease, "implementation-0:turn", "turn-start", {});
  f.store.completeOperation(f.lease, "implementation-0:turn", {
    turnId: "turn",
  });
  f.store.beginTurn(f.lease, "task", "turn");
}
test("startup leaves a live worker untouched and does not invoke continuation", async (t) => {
  const f = await fixture(t);
  assert.equal(
    await f.recovery().run(async () => assert.fail("must not resume")),
    "busy",
  );
  assert.deepEqual(f.calls, []);
  assert.equal(f.store.job(f.id).leaseOwner, "crashed");
});
test("startup recovers the same interrupted job before continuing and charges its durable budget", async (t) => {
  const f = await fixture(t);
  turn(f);
  f.time(1101);
  let resumed = false;
  const result = await f.recovery().run(async (context) => {
    assert.equal(f.store.job(f.id).activeTurnId, null);
    f.store.resumeRecovery(context.lease, "preparing", 2);
    resumed = true;
    f.store.blockAndRelease(context.lease, "test-complete");
  });
  assert.equal(resumed, true);
  assert.equal(result, "blocked");
  assert.deepEqual(f.calls, [
    ["authorize"],
    ["reconcile", "implementation-0"],
    ["observe", false],
  ]);
});
test("withdrawn authorization stops the owned turn without continuing execution", async (t) => {
  const f = await fixture(t);
  turn(f);
  f.time(1101);
  f.intake.authorize = async () => {
    f.store.cancel(f.id, "withdrawn");
    throw Error("private token");
  };
  assert.equal(
    await f.recovery().run(async () => assert.fail("must not resume")),
    "cancelled",
  );
  assert.deepEqual(f.calls, [
    ["reconcile", "implementation-0"],
    ["observe", true],
  ]);
  assert.doesNotMatch(JSON.stringify(f.store.events(f.id)), /private token/);
});
test("uncertain lost response preserves the pending intent and blocks competing intake execution", async (t) => {
  const f = await fixture(t);
  turn(f);
  f.time(1101);
  f.agent.reconcileRecorded = async () => {
    throw Error("remote unavailable");
  };
  assert.equal(
    await f.recovery().run(async () => assert.fail("must not resume")),
    "reconciliation-required",
  );
  assert.equal(f.store.job(f.id).activeTurnId, "turn");
  assert.equal(f.store.claim("competitor", 100), null);
});
test("startup reconstructs a pre-intent deadline without a new task and leaves ordinary blocked work alone", async (t) => {
  const f = await fixture(t);
  f.time(1101);
  let resumed = false;
  await f.recovery().run(async (context) => {
    assert.equal(f.store.operations(f.id)[0].input.deadline, 11000);
    f.store.resumeRecovery(context.lease, "preparing", 2);
    resumed = true;
    f.store.blockAndRelease(context.lease, "verification-failed");
  });
  assert.equal(resumed, true);
  assert.equal(
    await f.recovery().run(async () => assert.fail("no implicit retry")),
    "clear",
  );
});

test("an expired execution deadline permits only stopping the recorded turn", async (t) => {
  const f = await fixture(t);
  turn(f);
  f.time(11000);
  let resumed = false;
  const result = await f.recovery().run(async () => {
    resumed = true;
  });
  assert.equal(resumed, false);
  assert.equal(result, "blocked");
  assert.equal(f.store.job(f.id).activeTurnId, null);
  assert.equal(
    f.store.job(f.id).blockCode,
    "recovery-budget-exhausted-or-invalid",
  );
  assert.deepEqual(f.calls, [
    ["authorize"],
    ["reconcile", "implementation-0"],
    ["observe", true],
  ]);
});

test("a failed recovered turn never silently starts a replacement", async (t) => {
  const f = await fixture(t);
  turn(f);
  f.time(1101);
  f.agent.observe = async (context) => {
    f.store.finishTurn(context.lease, "turn");
    return "failed";
  };
  let resumed = false;
  assert.equal(
    await f.recovery().run(async () => {
      resumed = true;
    }),
    "blocked",
  );
  assert.equal(resumed, false);
  assert.equal(f.store.job(f.id).activeTurnId, null);
  assert.equal(f.store.job(f.id).blockCode, "recovered-turn-failed");
});

test("startup refuses to ignore an earlier uncertain task send while observing a later task", async (t) => {
  const f = await fixture(t);
  f.store.operation(f.lease, "implementation-budget", "execution-budget", {
    deadline: 10000,
  });
  f.store.completeOperation(f.lease, "implementation-budget", {
    deadline: 10000,
  });
  f.store.operation(f.lease, "earlier:thread", "thread-start", {});
  f.store.operation(f.lease, "later:thread", "thread-start", {});
  f.time(1101);
  let resumed = false;
  await f.recovery().run(async () => {
    resumed = true;
  });
  assert.equal(resumed, false);
  assert.deepEqual(f.calls, [["authorize"]]);
  assert.equal(
    f.store.operations(f.id).filter((o) => o.status === "pending").length,
    2,
  );
  assert.equal(f.store.claim("competitor", 100), null);
});

test("resource pressure permits owned observation and stopping but never execution continuation", async (t) => {
  const f = await fixture(t);
  turn(f);
  f.time(1101);
  let continued = false;
  const result = await f
    .recovery({
      canContinue: () => {
        throw Error("memory-reserve-unavailable");
      },
    })
    .run(async () => {
      continued = true;
    });
  assert.equal(continued, false);
  assert.equal(result, "blocked");
  assert.equal(f.store.job(f.id).activeTurnId, null);
  assert.equal(f.store.job(f.id).blockCode, "recovery-resource-unavailable");
  assert.deepEqual(f.calls, [
    ["authorize"],
    ["reconcile", "implementation-0"],
    ["observe", true],
  ]);
});
