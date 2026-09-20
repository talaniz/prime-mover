import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";
const projects = JSON.parse(readFileSync("config.example.json")).projects;
async function child(filename, mode, owner) {
  const p = fork("test/fixtures/store-worker.mjs", [filename, mode, owner], {
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  await once(p, "message");
  return p;
}
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "pm-process-"));
  const filename = join(dir, "store.db");
  const s = new Store(filename);
  s.seedProjects(projects);
  s.enqueue("prime-mover", 1, {});
  s.enqueue("doom-dashboard", 2, {});
  t.after(() => {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { s, filename };
}
test("separate worker processes racing for different projects claim exactly one global job", async (t) => {
  const { filename, s } = fixture(t);
  const a = await child(filename, "claim", "one");
  const b = await child(filename, "claim", "two");
  t.after(() => {
    a.kill();
    b.kill();
  });
  const replies = [once(a, "message"), once(b, "message")];
  a.send("claim");
  b.send("claim");
  const result = await Promise.all(replies);
  assert.equal(result.filter(([r]) => r.lease).length, 1);
  assert.equal(s.jobs().filter((j) => j.leaseOwner).length, 1);
});
test("killed worker retains pause, lease, attempts and operation intent across reopen", async (t) => {
  const { filename, s } = fixture(t);
  const p = await child(filename, "hold", "lost-worker");
  t.after(() => p.kill());
  const reply = once(p, "message");
  p.send("claim");
  const [r] = await reply;
  assert.ok(r.lease);
  const exited = once(p, "exit");
  p.kill("SIGKILL");
  await exited;
  s.close();
  const reopened = new Store(filename);
  try {
    assert.equal(reopened.paused(), true);
    assert.equal(reopened.job(r.lease.jobId).attempts, 1);
    assert.equal(reopened.operations(r.lease.jobId)[0].status, "pending");
    reopened.setPaused(false);
    assert.equal(reopened.claim("replacement", 1000), null);
  } finally {
    reopened.close();
  }
});
