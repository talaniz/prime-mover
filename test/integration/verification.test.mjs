import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runIsolated } from "../../dist/verification.js";
function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "pm-verification-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
test("configured argv stays literal and actual successful output is captured", async (t) => {
  const cwd = fixture(t);
  const literal = "$(touch /tmp/pm-should-not-run); echo injected";
  const r = await runIsolated(
    cwd,
    ["node", "-e", "console.log(process.argv[1])", literal],
    { timeoutMs: 5000 },
  );
  assert.equal(r.status, "passed");
  assert.equal(r.stdout.trim(), literal);
  assert.equal(r.exitCode, 0);
});
test("nonzero verification fails and timed out subprocess never counts as passed", async (t) => {
  const cwd = fixture(t);
  const fail = await runIsolated(cwd, ["node", "-e", "process.exit(17)"], {
    timeoutMs: 5000,
  });
  assert.equal(fail.status, "failed");
  assert.equal(fail.exitCode, 17);
  const timeout = await runIsolated(
    cwd,
    ["node", "-e", "setInterval(()=>{},1000)"],
    { timeoutMs: 100 },
  );
  assert.equal(timeout.status, "timeout");
});
test("sandbox hides host homes and credential environment while permitting worktree output", async (t) => {
  const cwd = fixture(t);
  const secret = mkdtempSync(join(tmpdir(), "pm-host-secret-"));
  writeFileSync(join(secret, "secret"), "HOST_ONLY");
  t.after(() => rmSync(secret, { recursive: true, force: true }));
  process.env.PM_TEST_PRIVATE_TOKEN = "HOST_ONLY";
  t.after(() => delete process.env.PM_TEST_PRIVATE_TOKEN);
  const r = await runIsolated(
    cwd,
    [
      "node",
      "-e",
      `const fs=require('fs');if(process.env.PM_TEST_PRIVATE_TOKEN||fs.existsSync('/home/palpatine/.codex')||fs.existsSync(${JSON.stringify(join(secret, "secret"))}))process.exit(91);fs.writeFileSync('result.txt','isolated');console.log('hidden');`,
    ],
    { timeoutMs: 5000 },
  );
  assert.equal(r.status, "passed", r.stderr);
  assert.equal(r.stdout.trim(), "hidden");
  assert.equal(readFileSync(join(cwd, "result.txt"), "utf8"), "isolated");
});
test("pre-aborted verification does not run command or report success", async (t) => {
  const cwd = fixture(t);
  const c = new AbortController();
  c.abort();
  const r = await runIsolated(cwd, ["node", "-e", 'console.log("ran")'], {
    timeoutMs: 5000,
    signal: c.signal,
  });
  assert.equal(r.status, "cancelled");
  assert.equal(r.stdout, "");
});
test("verification cannot contact a host listener by default", async (t) => {
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => res.end("host-private"));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const cwd = fixture(t);
  const r = await runIsolated(
    cwd,
    [
      "node",
      "-e",
      `fetch('http://127.0.0.1:${server.address().port}').then(()=>process.exit(92)).catch(()=>console.log('network-isolated'))`,
    ],
    { timeoutMs: 5000 },
  );
  assert.equal(r.status, "passed", r.stderr);
  assert.equal(r.stdout.trim(), "network-isolated");
});
test("excess output and mid-command cancellation are bounded failures", async (t) => {
  const cwd = fixture(t);
  const large = await runIsolated(
    cwd,
    [
      "node",
      "-e",
      'const fs=require("fs");const b=Buffer.alloc(65536,120);for(;;)fs.writeSync(1,b)',
    ],
    { timeoutMs: 5000 },
  );
  assert.equal(large.status, "output-limit");
  assert.ok(large.stdout.length <= 4 * 1024 * 1024);
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 100);
  const cancelled = await runIsolated(
    cwd,
    ["node", "-e", "setInterval(()=>{},1000)"],
    { timeoutMs: 5000, signal: c.signal },
  );
  clearTimeout(timer);
  assert.equal(cancelled.status, "cancelled");
});
