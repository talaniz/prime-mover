import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { completed } from "../support/outcome-fixture.mjs";
import { Store } from "../../dist/store.js";
function setup(t) {
  const f = completed(t);
  f.store.revokeReadiness(f.id, "readiness-check-failed");
  f.store.setPaused(true);
  f.store.close();
  const mount = mkdtempSync(join(tmpdir(), "pm-outcome-cli-"));
  t.after(() => rmSync(mount, { recursive: true, force: true }));
  const bin = join(mount, "bin");
  mkdirSync(bin);
  const c = JSON.parse(readFileSync("config.example.json"));
  c.storage = {
    mount,
    uuid: "fixture",
    root: join(mount, "runtime"),
    minFreeBytes: 1024,
  };
  c.metadata.socket = join(c.storage.root, "metadata.sock");
  const database = join(c.storage.root, "data", "prime-mover", "jobs.sqlite");
  mkdirSync(join(database, ".."), { recursive: true });
  copyFileSync(f.databasePath, database);
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
      ")",
    { mode: 0o700 },
  );
  const payload = {
    number: 3,
    state: "closed",
    merged: true,
    merged_at: f.outcome.mergedAt,
    merge_commit_sha: f.outcome.mergeCommit,
    head: { sha: f.outcome.head, repo: { full_name: f.project.repository } },
    base: {
      ref: f.project.baseBranch,
      repo: { full_name: f.project.repository },
    },
  };
  const response = join(mount, "response.json");
  writeFileSync(response, JSON.stringify(payload));
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
import fs from 'node:fs';
if(!process.argv.includes('GET') || !process.argv.includes('repos/${f.project.repository}/pulls/3'))process.exit(4);
console.log('HTTP/2 200 OK\\n\\n'+fs.readFileSync(${JSON.stringify(response)},'utf8'));
`,
    { mode: 0o700 },
  );
  const run = (...args) =>
    spawnSync(
      process.execPath,
      ["dist/cli.js", "reconcile-outcomes", config, ...args],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: bin + ":" + process.env.PATH },
        timeout: 15000,
      },
    );
  return { ...f, database, run, response, payload };
}
test("CLI previews without DB changes, applies while paused, and repeats without new events", (t) => {
  const f = setup(t),
    before = readFileSync(f.database);
  let r = f.run();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).results[0].outcome, "merged");
  assert.deepEqual(readFileSync(f.database), before);
  r = f.run("--apply");
  assert.equal(r.status, 0, r.stderr);
  const inspect = () => {
    const s = new Store(f.database, Date.now, true);
    try {
      return {
        job: s.job(f.id),
        events: s.events(f.id),
        operations: s.operations(f.id),
        notifications: s.notifications(f.id),
      };
    } finally {
      s.close();
    }
  };
  const first = inspect();
  assert.equal(first.job.stage, "merged");
  assert.equal(f.run("--apply", f.id).status, 0);
  assert.deepEqual(inspect(), first);
});
test("CLI refuses unpaused application and bad remote identity without changing job", (t) => {
  const f = setup(t);
  let s = new Store(f.database);
  s.setPaused(false);
  s.close();
  assert.equal(f.run("--apply").status, 1);
  s = new Store(f.database);
  s.setPaused(true);
  s.close();
  writeFileSync(f.response, JSON.stringify({ ...f.payload, number: 4 }));
  assert.equal(f.run("--apply").status, 1);
  s = new Store(f.database, Date.now, true);
  assert.equal(s.job(f.id).stage, "blocked");
  s.close();
});
