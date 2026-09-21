import test from "node:test";
import assert from "node:assert/strict";
async function fixture(jobs = [], paused = false) {
  const { workerCycle } = await import("../../dist/worker-cycle.js");
  const calls = [];
  const state = { jobs: () => jobs, paused: () => paused };
  const services = {
    preflight: async () => {
      calls.push("preflight");
    },
    recover: async () => {
      calls.push("recover");
      return "clear";
    },
    recheck: async (id) => {
      calls.push(`recheck:${id}`);
    },
    poll: async () => {
      calls.push("poll");
    },
    review: async (id, role) => {
      calls.push(`${role}:${id}`);
      return "ready";
    },
    implement: async () => {
      calls.push("implement");
      return "pr-open";
    },
  };
  return { calls, services, run: () => workerCycle(state, services) };
}
test("a cycle performs preflight and recovery before intake and one implementation", async () => {
  const f = await fixture();
  assert.equal(await f.run(), "pr-open");
  assert.deepEqual(f.calls, ["preflight", "recover", "poll", "implement"]);
});
test("an uncertain reservation prevents all intake and competing execution", async () => {
  const f = await fixture();
  f.services.recover = async () => {
    f.calls.push("recover");
    return "reconciliation-required";
  };
  assert.equal(await f.run(), "reconciliation-required");
  assert.deepEqual(f.calls, ["preflight", "recover"]);
});
test("reviews advance existing work before polling more issues, one stage per cycle", async () => {
  const f = await fixture([
    { id: "one", stage: "pr-open", cancelRequested: false },
    { id: "two", stage: "e2e-review", cancelRequested: false },
  ]);
  assert.equal(await f.run(), "ready");
  assert.deepEqual(f.calls, ["preflight", "recover", "code-review:one"]);
});
test("paused intake still validates ready results but starts no review or implementation", async () => {
  const f = await fixture(
    [
      { id: "ready", stage: "ready" },
      { id: "review", stage: "e2e-review" },
    ],
    true,
  );
  assert.equal(await f.run(), "paused");
  assert.deepEqual(f.calls, ["preflight", "recover", "recheck:ready"]);
});
test("storage/dependency preflight failure performs no recovery or intake", async () => {
  const f = await fixture();
  f.services.preflight = async () => {
    throw Error("missing mount");
  };
  await assert.rejects(f.run(), /missing mount/);
  assert.deepEqual(f.calls, []);
});
