import test from "node:test";
import assert from "node:assert/strict";
const load = async () =>
  (await import("../../dist/resources.js")).checkResources;
test("preflight uses available memory including reclaimable cache instead of free pages alone", async () => {
  const check = await load();
  const result = check(
    () =>
      "MemTotal: 4000000 kB\nMemFree: 1000 kB\nMemAvailable: 1000000 kB\nSwapFree: 0 kB\n",
  );
  assert.equal(result.availableBytes, 1024000000);
  assert.equal(result.minimumBytes, 268435456);
});
test("low available memory blocks new work even when swap is available", async () => {
  const check = await load();
  assert.throws(
    () =>
      check(
        () =>
          "MemTotal: 4000000 kB\nMemAvailable: 100000 kB\nSwapFree: 8000000 kB\n",
      ),
    /memory-reserve/,
  );
});
test("missing, malformed or unreadable memory evidence fails closed without reflecting private errors", async () => {
  const check = await load();
  for (const value of [
    "",
    "MemAvailable: -1 kB\n",
    "MemAvailable: 1000000 bytes\n",
    "MemAvailable: 1 kB\nMemAvailable: 1000000 kB\n",
  ])
    assert.throws(() => check(() => value), /memory-evidence/);
  assert.throws(
    () =>
      check(() => {
        throw Error("private details");
      }),
    /^Error: memory-evidence-unavailable$/,
  );
});

test("unattended service requires a real kernel memory controller, not accepted systemd properties", async () => {
  const { requireMemoryController } = await import("../../dist/resources.js");
  assert.throws(
    () => requireMemoryController(() => "cpuset cpu io pids\n"),
    /memory-controller-unavailable/,
  );
  assert.throws(
    () =>
      requireMemoryController(() => {
        throw Error("private detail");
      }),
    /^Error: memory-controller-unavailable: enable kernel memory accounting before unattended service activation$/,
  );
  assert.doesNotThrow(() =>
    requireMemoryController(() => "cpuset cpu io memory pids\n"),
  );
});
