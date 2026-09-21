import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../../dist/store.js";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pm-backup-"));
  const filename = join(root, "jobs.sqlite"),
    store = new Store(filename, () => 1000);
  store.seedProjects(JSON.parse(readFileSync("config.example.json")).projects);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, store, filename };
}
test("online SQLite snapshot and isolated restore preserve WAL commits, leases, uncertain intents and consumed budgets", async (t) => {
  const f = fixture(t),
    id = f.store.enqueue("prime-mover", 17, {
      objective: "Retain owned execution",
    }),
    lease = f.store.claim("worker", 10000);
  f.store.operation(lease, "owned-task", "thread-start", {
    source: "owned-source",
  });
  f.store.consumeBudget(lease, "transport-errors", 2);
  const second = new Store(f.filename, () => 1000);
  try {
    second.enqueue("doom-dashboard", 18, { objective: "WAL writer" });
  } finally {
    second.close();
  }
  const file = join(f.root, "backup.sqlite");
  const receipt = await f.store.backupTo(file);
  assert.equal(receipt.schemaVersion, 2);
  assert.equal(receipt.jobs, 2);
  assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const restored = join(f.root, "restored.sqlite");
  await Store.restoreBackup(file, restored);
  const copy = new Store(restored, () => 1000);
  try {
    assert.deepEqual(copy.jobs(), f.store.jobs());
    assert.deepEqual(copy.operations(id), f.store.operations(id));
    assert.equal(copy.claim("duplicate", 1000), null);
    assert.equal(copy.consumeBudget(lease, "transport-errors", 2), 2);
    assert.throws(
      () => copy.consumeBudget(lease, "transport-errors", 2),
      /budget/i,
    );
  } finally {
    copy.close();
  }
  assert.equal(f.store.consumeBudget(lease, "transport-errors", 2), 2);
});
test("backup refuses existing files and symlinks without altering them", async (t) => {
  const f = fixture(t),
    file = join(f.root, "keep");
  writeFileSync(file, "preserve");
  await assert.rejects(() => f.store.backupTo(file));
  assert.equal(readFileSync(file, "utf8"), "preserve");
  const link = join(f.root, "link");
  symlinkSync(file, link);
  await assert.rejects(() => f.store.backupTo(link));
  assert.equal(readFileSync(file, "utf8"), "preserve");
});
test("restore refuses corrupt input, existing runtime files and sidecars", async (t) => {
  const f = fixture(t),
    file = join(f.root, "backup.sqlite");
  await f.store.backupTo(file);
  await assert.rejects(() => Store.restoreBackup(file, f.filename));
  const target = join(f.root, "restore.sqlite");
  writeFileSync(target + "-wal", "preserve");
  await assert.rejects(() => Store.restoreBackup(file, target));
  assert.equal(readFileSync(target + "-wal", "utf8"), "preserve");
  const corrupt = join(f.root, "corrupt.sqlite");
  writeFileSync(corrupt, "not sqlite");
  await assert.rejects(() =>
    Store.restoreBackup(corrupt, join(f.root, "bad.sqlite")),
  );
});
