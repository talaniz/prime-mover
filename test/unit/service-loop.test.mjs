import test from "node:test";
import assert from "node:assert/strict";
const load = async () =>
  (await import("../../dist/service-loop.js")).serviceLoop;
test("service runs finite cycles sequentially and resets consecutive failures after success", async () => {
  const loop = await load();
  let active = 0,
    maximum = 0,
    calls = 0;
  const result = await loop(
    async () => {
      active++;
      maximum = Math.max(maximum, active);
      calls++;
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return calls === 2;
    },
    {
      intervalMs: 1,
      maxCycles: 3,
      maxConsecutiveFailures: 2,
      signal: new AbortController().signal,
    },
  );
  assert.equal(result.cycles, 3);
  assert.equal(calls, 3);
  assert.equal(maximum, 1);
});
test("service stops after its configured consecutive failure bound with a redacted error", async () => {
  const loop = await load();
  let calls = 0;
  await assert.rejects(
    loop(
      async () => {
        calls++;
        throw Error("private detail");
      },
      {
        intervalMs: 1,
        maxConsecutiveFailures: 2,
        signal: new AbortController().signal,
      },
    ),
    /service-cycle-failure-limit/,
  );
  assert.equal(calls, 2);
});
test("shutdown wakes interval sleep and starts no next cycle", async () => {
  const loop = await load(),
    stop = new AbortController();
  let calls = 0;
  const pending = loop(
    async () => {
      calls++;
      setTimeout(() => stop.abort(), 5);
      return true;
    },
    { intervalMs: 60000, maxConsecutiveFailures: 2, signal: stop.signal },
  );
  const result = await pending;
  assert.equal(calls, 1);
  assert.equal(result.stopped, true);
});
