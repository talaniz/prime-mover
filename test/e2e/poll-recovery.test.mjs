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
for (const mode of ["live", "expired", "pending"])
  test(`standalone poll refuses ${mode} execution ownership before contacting GitHub`, (t) => {
    const mount = mkdtempSync(join(tmpdir(), "pm-poll-recovery-")),
      bin = join(mount, "bin");
    mkdirSync(bin);
    t.after(() => rmSync(mount, { recursive: true, force: true }));
    const config = JSON.parse(readFileSync("config.example.json"));
    config.storage = {
      mount,
      uuid: "fixture",
      root: join(mount, "runtime"),
      minFreeBytes: 1024,
    };
    config.metadata.socket = join(config.storage.root, "metadata.sock");
    const file = join(mount, "config.json");
    writeFileSync(file, JSON.stringify(config));
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
    const marker = join(mount, "github-called");
    writeFileSync(
      join(bin, "gh"),
      '#!/usr/bin/env node\nrequire("fs").writeFileSync(' +
        JSON.stringify(marker) +
        ',"called");process.exit(1);\n',
      { mode: 0o700 },
    );
    const dir = join(config.storage.root, "data", "prime-mover");
    mkdirSync(dir, { recursive: true });
    const s = new Store(join(dir, "jobs.sqlite"));
    s.seedProjects(config.projects);
    const id = s.enqueue("prime-mover", 1, {}),
      lease = s.claim("old", mode === "expired" ? 1 : 30000);
    if (mode === "pending") {
      s.operation(lease, "uncertain", "thread-start", {});
      s.blockAndRelease(lease, "uncertain");
    }
    s.close();
    const r = spawnSync(process.execPath, ["dist/cli.js", "poll", file], {
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, PATH: bin + ":" + process.env.PATH },
    });
    assert.equal(
      existsSync(marker),
      false,
      "GitHub intake must not run before ownership recovery",
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /recovery/i);
    const check = new Store(join(dir, "jobs.sqlite"));
    assert.equal(check.job(id).attempts, 1);
    check.close();
  });
