import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { Store } from "../../dist/store.js";
function fixture(t) {
  const mount = mkdtempSync(join(tmpdir(), "pm-backup-cli-")),
    bin = join(mount, "bin");
  mkdirSync(bin);
  t.after(() => rmSync(mount, { recursive: true, force: true }));
  const c = JSON.parse(readFileSync("config.example.json"));
  c.storage = {
    mount,
    uuid: "fixture",
    root: join(mount, "runtime"),
    minFreeBytes: 1024,
  };
  c.metadata.socket = join(c.storage.root, "metadata.sock");
  const config = join(mount, "config.json");
  writeFileSync(config, JSON.stringify(c));
  writeFileSync(
    join(bin, "findmnt"),
    "#!/usr/bin/env node\nconsole.log(" +
      JSON.stringify(
        JSON.stringify({
          filesystems: [
            { target: mount, uuid: "fixture", fstype: "ext4", options: "rw" },
          ],
        }),
      ) +
      ");\n",
    { mode: 0o700 },
  );
  const dir = join(c.storage.root, "data", "prime-mover");
  mkdirSync(dir, { recursive: true });
  const store = new Store(join(dir, "jobs.sqlite"));
  store.seedProjects(c.projects);
  store.enqueue("prime-mover", 42, { objective: "Preserve job" });
  store.close();
  const run = (command, ...args) =>
    spawnSync(process.execPath, ["dist/cli.js", command, config, ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: bin + ":" + process.env.PATH },
    });
  return { mount, c, run };
}
test("operator creates a consistent backup and checks a paused isolated restore without starting execution", (t) => {
  const f = fixture(t),
    backup = join(f.c.storage.root, "backups", "snapshot.sqlite"),
    restored = join(f.c.storage.root, "restores", "proof", "jobs.sqlite");
  let r = f.run("backup", backup);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).jobs, 1);
  r = f.run("restore-check", backup, restored);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).executionStarted, false);
  const s = new Store(restored);
  try {
    assert.equal(s.paused(), true);
    assert.equal(s.jobs()[0].issue, 42);
  } finally {
    s.close();
  }
  assert.equal(f.run("backup", backup).status, 1);
  assert.equal(f.run("restore-check", backup, restored).status, 1);
});
test("backup and restore commands refuse destinations outside their isolated subdirectories", (t) => {
  const f = fixture(t),
    outside = join(f.mount, "outside.sqlite");
  assert.equal(f.run("backup", outside).status, 1);
  assert.equal(existsSync(outside), false);
  const backup = join(f.c.storage.root, "backups", "valid.sqlite");
  assert.equal(f.run("backup", backup).status, 0);
  assert.equal(
    f.run(
      "restore-check",
      backup,
      join(f.c.storage.root, "data", "prime-mover", "jobs.sqlite"),
    ).status,
    1,
  );
});
