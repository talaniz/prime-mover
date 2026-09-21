import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../../dist/store.js";
import { CommandEvidence } from "../../dist/command-evidence.js";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pm-command-recovery-"));
  const config = JSON.parse(readFileSync("config.example.json"));
  config.storage.root = root;
  const store = new Store(join(root, "db"));
  store.seedProjects(config.projects);
  const id = store.enqueue("prime-mover", 1, {}),
    lease = store.claim("worker", 30000);
  const context = {
    lease,
    signal: new AbortController().signal,
    assertActive: () => store.assertWorker(lease),
  };
  const cwd = join(root, "worktree");
  mkdirSync(cwd);
  const marker = join(cwd, "must-not-run");
  const argv = [
    process.execPath,
    "-e",
    "require('fs').writeFileSync('must-not-run','executed')",
  ];
  const deadline = Date.now() + 10000,
    key = "verify:recorded:0";
  const input = { cwd, argv, deadline, network: false };
  store.operation(lease, key, "verification", input);
  const dir = join(root, "artifacts", id);
  mkdirSync(dir, { recursive: true });
  const artifact = join(dir, "verify-recorded-0.json");
  const runner = new CommandEvidence(store, config, {
    authorize: async () => ({}),
  });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    id,
    key,
    input,
    artifact,
    marker,
    run: () =>
      runner.run(
        context,
        { cwd, bare: join(root, "bare") },
        argv,
        key,
        "verification",
        deadline,
      ),
  };
}
test("a pending command without a durable result blocks instead of rerunning the command", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.run(), /command-result-uncertain/);
  assert.equal(existsSync(f.marker), false);
  assert.equal(f.store.operations(f.id)[0].status, "pending");
});
test("a matching crash artifact completes the same intent without rerunning the command", async (t) => {
  const f = fixture(t),
    result = {
      status: "passed",
      exitCode: 0,
      stdout: "recorded",
      stderr: "",
      startedAt: 1,
      completedAt: 2,
    };
  writeFileSync(
    f.artifact,
    JSON.stringify({ jobId: f.id, key: f.key, input: f.input, result }),
  );
  assert.deepEqual(await f.run(), { result, artifact: f.artifact });
  assert.equal(existsSync(f.marker), false);
  assert.equal(f.store.operations(f.id)[0].status, "done");
});
test("an artifact for another invocation cannot acknowledge a pending command", async (t) => {
  const f = fixture(t);
  writeFileSync(
    f.artifact,
    JSON.stringify({
      jobId: f.id,
      key: f.key,
      input: { ...f.input, argv: ["other"] },
      result: { status: "passed", exitCode: 0 },
    }),
  );
  await assert.rejects(f.run(), /command-evidence-mismatch/);
  assert.equal(existsSync(f.marker), false);
  assert.equal(f.store.operations(f.id)[0].status, "pending");
});
