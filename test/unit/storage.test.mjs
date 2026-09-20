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
