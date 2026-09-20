import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../../dist/store.js";
import { Scheduler } from "../../dist/scheduler.js";
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "pm-scheduler-"));
  const s = new Store(join(dir, "s.db"));
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
