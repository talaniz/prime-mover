import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../../dist/store.js";
import { Scheduler } from "../../dist/scheduler.js";
function setup(t, clock) {
  const dir = mkdtempSync(join(tmpdir(), "pm-scheduler-"));
  const s = new Store(join(dir, "s.db"), clock);
  s.seedProjects(JSON.parse(readFileSync("config.example.json")).projects);
  const id = s.enqueue("prime-mover", 1, {});
  t.after(() => {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { s, id };
}
test("fake external adapter runs one claim and failure becomes redacted blocked state", async (t) => {
  const { s, id } = setup(t);
  let calls = 0;
  const result = await new Scheduler(s, "worker").runOnce(async (context) => {
    context.assertActive();
    calls++;
    throw Error("private-secret-error");
  });
  assert.equal(calls, 1);
  assert.equal(result, "blocked");
  assert.equal(s.job(id).blockCode, "external-state-unknown");
  assert.equal(s.job(id).leaseOwner, null);
  assert.doesNotMatch(JSON.stringify(s.events(id)), /private-secret-error/);
});
test("operator cancellation aborts adapter context and finalizes after safe unwind", async (t) => {
  const { s, id } = setup(t);
  const result = await new Scheduler(s, "worker", 300).runOnce(
    async (context) => {
      s.cancel(id, "operator stop");
      await new Promise((r) =>
        context.signal.addEventListener("abort", r, { once: true }),
      );
      assert.throws(() => context.assertActive(), /cancel|lease/i);
    },
  );
  assert.equal(result, "cancelled");
  assert.equal(s.job(id).stage, "cancelled");
});

test("recovery scheduler renews observation ownership after cancellation without authorizing execution", async (t) => {
  let now = 1000;
  const { s, id } = setup(t, () => now);
  const old = s.claim("old", 100);
  s.beginTurn(old, "owned-task", "owned-turn");
  s.cancel(id, "stop interrupted work");
  now = 1101;
  const recovered = s.claimRecovery(id, "observer", 300);
  const result = await new Scheduler(s, "observer", 300).runClaimed(
    recovered,
    async (context) => {
      assert.equal(context.signal.aborted, true);
      assert.throws(() => context.assertActive(), /cancel|lease/i);
      now = 1300;
      await new Promise((resolve) => setTimeout(resolve, 120));
      assert.ok(
        s.job(id).leaseUntil > 1401,
        "observation lease must renew despite cancellation",
      );
      now = 1450;
      assert.throws(() => s.finishTurn(old, "owned-turn"), /lease/i);
      s.finishTurn(recovered, "owned-turn");
    },
    { reconciliation: true },
  );
  assert.equal(result, "cancelled");
  assert.equal(s.job(id).activeTurnId, null);
  assert.equal(s.job(id).leaseOwner, null);
});

test("recovery scheduler retains an uncertain cancelled turn when observation fails", async (t) => {
  let now = 1000;
  const { s, id } = setup(t, () => now);
  const old = s.claim("old", 100);
  s.beginTurn(old, "owned-task", "owned-turn");
  s.cancel(id, "stop interrupted work");
  now = 1101;
  const recovered = s.claimRecovery(id, "observer", 300);
  const result = await new Scheduler(s, "observer", 300).runClaimed(
    recovered,
    async () => {
      throw new Error("unavailable remote");
    },
    { reconciliation: true },
  );
  assert.equal(result, "reconciliation-required");
  assert.equal(s.job(id).activeTurnId, "owned-turn");
  assert.equal(s.claim("competing", 300), null);
});

test("recovery observation aborts after lease loss and cannot clear the successor's reservation", async (t) => {
  let now = 1000;
  const { s, id } = setup(t, () => now);
  const old = s.claim("old", 100);
  s.beginTurn(old, "owned-task", "owned-turn");
  now = 1101;
  const recovered = s.claimRecovery(id, "observer", 300);
  let successor,
    observed = false;
  const result = await new Scheduler(s, "observer", 300).runClaimed(
    recovered,
    async (context) => {
      now = 1402;
      successor = s.claimRecovery(id, "successor", 300);
      await new Promise((resolve) => setTimeout(resolve, 120));
      assert.equal(context.signal.aborted, true);
      assert.throws(() => context.assertActive(), /lease/i);
      assert.throws(() => s.finishTurn(recovered, "owned-turn"), /lease/i);
      observed = true;
    },
    { reconciliation: true },
  );
  assert.equal(observed, true);
  assert.equal(result, "reconciliation-required");
  assert.equal(s.job(id).leaseOwner, successor.owner);
  assert.equal(s.job(id).activeTurnId, "owned-turn");
});

test("service shutdown aborts execution but retains ownership until the owned turn is reconciled", async (t) => {
  const { s, id } = setup(t);
  const shutdown = new AbortController();
  let observed = false;
  const result = await new Scheduler(
    s,
    "service",
    300,
    shutdown.signal,
  ).runOnce(async (context) => {
    s.beginTurn(context.lease, "owned", "turn");
    shutdown.abort();
    assert.equal(context.signal.aborted, true);
    assert.throws(() => context.assertActive(), /stop|lease|cancel/i);
    assert.equal(s.claim("competitor", 300), null);
    s.finishTurn(context.lease, "turn");
    observed = true;
  });
  assert.equal(observed, true);
  assert.equal(result, "blocked");
  assert.equal(s.job(id).activeTurnId, null);
  assert.equal(s.job(id).leaseOwner, null);
});

test("an already stopping service cannot claim a queued job", async (t) => {
  const { s, id } = setup(t);
  const shutdown = new AbortController();
  shutdown.abort();
  assert.equal(
    await new Scheduler(s, "service", 300, shutdown.signal).runOnce(async () =>
      assert.fail("must not execute"),
    ),
    "stopped",
  );
  assert.equal(s.job(id).stage, "queued");
  assert.equal(s.job(id).attempts, 0);
});
