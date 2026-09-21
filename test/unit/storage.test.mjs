import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkStorage } from "../../dist/storage.js";
test("absent or wrong expected mount blocks before creating fallback data", () => {
  const dir = mkdtempSync(join(tmpdir(), "pm-mount-"));
  try {
    const c = JSON.parse(readFileSync("config.example.json"));
    c.storage = {
      mount: join(dir, "absent"),
      root: join(dir, "absent", "state"),
      uuid: "wrong-device",
    };
    assert.throws(() => checkStorage(c), /storage|mount/i);
    assert.equal(existsSync(c.storage.root), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("dangling symlinks cannot redirect a future SQLite file off the expected volume", async () => {
  const { symlinkSync } = await import("node:fs");
  const { safeDescendant } = await import("../../dist/storage.js");
  const dir = mkdtempSync(join(tmpdir(), "pm-link-"));
  try {
    symlinkSync(join(dir, "missing-target"), join(dir, "jobs.sqlite"));
    assert.throws(
      () => safeDescendant(dir, join(dir, "jobs.sqlite")),
      /symlink/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function capacityFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "pm-capacity-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = JSON.parse(readFileSync("config.example.json"));
  config.storage = {
    mount: dir,
    root: join(dir, "runtime"),
    uuid: "fixture-device",
    minFreeBytes: 1024,
  };
  config.metadata.socket = join(config.storage.root, "metadata.sock");
  const probe = {
    mount: () => ({
      target: dir,
      uuid: "fixture-device",
      fstype: "ext4",
      options: "rw,nodev",
    }),
    space: () => ({ availableBytes: 4096, availableInodes: 100 }),
  };
  return { config, probe };
}
test("verified mount with adequate capacity passes a read-only injectable preflight", (t) => {
  const f = capacityFixture(t);
  assert.doesNotThrow(() => checkStorage(f.config, f.probe));
  assert.equal(existsSync(f.config.storage.root), false);
});
for (const [name, space] of Object.entries({
  full: { availableBytes: 0, availableInodes: 100 },
  low: { availableBytes: 512, availableInodes: 100 },
  inodes: { availableBytes: 4096, availableInodes: 0 },
  unknown: { availableBytes: NaN, availableInodes: 100 },
}))
  test(`${name} storage cannot create fallback runtime state`, (t) => {
    const f = capacityFixture(t);
    f.probe.space = () => space;
    assert.throws(
      () => checkStorage(f.config, f.probe),
      /storage|space|capacity/i,
    );
    assert.equal(existsSync(f.config.storage.root), false);
  });
for (const [name, patch] of Object.entries({
  readonly: { options: "ro" },
  wrongUuid: { uuid: "other" },
  wrongMount: { target: "/" },
}))
  test(`${name} mount fails even with adequate free capacity`, (t) => {
    const f = capacityFixture(t),
      original = f.probe.mount;
    f.probe.mount = () => ({ ...original(), ...patch });
    assert.throws(() => checkStorage(f.config, f.probe), /storage|mount/i);
    assert.equal(existsSync(f.config.storage.root), false);
  });
