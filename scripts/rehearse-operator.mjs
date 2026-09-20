// Explicit live rehearsal in a disposable subtree on an already verified external mount.
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import http from "node:http";
import { validateConfig } from "../dist/config.js";
import { checkStorage } from "../dist/storage.js";
import { Store } from "../dist/store.js";
const [mount, uuid] = process.argv.slice(2);
if (!mount || !uuid)
  throw Error("Usage: rehearse-operator MOUNT VERIFIED_UUID");
const base = JSON.parse(readFileSync("config.example.json"));
base.storage = { mount, uuid, root: join(mount, "codex-work") };
base.metadata.socket = join(
  base.storage.root,
  "data",
  "prime-mover",
  "metadata.sock",
);
checkStorage(validateConfig(base));
const dir = mkdtempSync(join(base.storage.root, "operator-rehearsal-"));
const configPath = join(dir, "config.local.json");
base.storage.root = dir;
base.metadata.socket = join(dir, "data", "prime-mover", "metadata.sock");
base.metadata.tokenFile = join(dir, "token");
const token = randomBytes(32).toString("hex");
writeFileSync(base.metadata.tokenFile, token, { mode: 0o600 });
writeFileSync(configPath, JSON.stringify(base));
let server;
function run(command, ...args) {
  const r = spawnSync(
    process.execPath,
    ["dist/cli.js", command, configPath, ...args],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(r.status, 0, `${command}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}
function request(tokenValue) {
  return new Promise((resolve, reject) => {
    const q = http.get(
      {
        socketPath: base.metadata.socket,
        path: "/v1/projects",
        headers: { Authorization: `Bearer ${tokenValue}` },
      },
      (res) => {
        let body = "";
        res.on("data", (x) => (body += x));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: JSON.parse(body) }),
        );
      },
    );
    q.on("error", reject);
  });
}
try {
  assert.equal(run("doctor").executionStarted, false);
  assert.equal(
    existsSync(join(dir, "data", "prime-mover", "jobs.sqlite")),
    false,
  );
  assert.equal(run("status").projects.length, 2);
  assert.equal(run("pause").intakePaused, true);
  assert.equal(run("status").intakePaused, true);
  assert.equal(run("resume").intakePaused, false);
  const store = new Store(join(dir, "data", "prime-mover", "jobs.sqlite"));
  let cancelled, blocked;
  try {
    cancelled = store.enqueue("prime-mover", 1, { private: "not-in-inspect" });
    assert.equal(
      run("cancel", cancelled, "fixture cancellation").stage,
      "cancelled",
    );
    blocked = store.enqueue("doom-dashboard", 2, {});
    const lease = store.claim("fixture", 30000);
    store.blockAndRelease(lease, "operator");
  } finally {
    store.close();
  }
  assert.equal(run("retry", blocked, "fixture corrected").stage, "queued");
  assert.equal(run("inspect", blocked).projectId, "doom-dashboard");
  assert.doesNotMatch(
    JSON.stringify(run("inspect", cancelled)),
    /not-in-inspect/,
  );
  server = spawn(process.execPath, ["dist/cli.js", "metadata", configPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("metadata startup timed out")),
      15000,
    );
    server.stdout.once("data", () => {
      clearTimeout(timer);
      resolve();
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error(`metadata exited ${code}`));
    });
  });
  assert.equal(statSync(base.metadata.socket).mode & 0o777, 0o600);
  assert.equal((await request("bad")).status, 401);
  const result = await request(token);
  assert.equal(result.status, 200);
  assert.equal(result.body.projects.length, 2);
  const exit = once(server, "exit");
  server.kill("SIGTERM");
  await exit;
  server = undefined;
  const invalid = structuredClone(base);
  invalid.storage.uuid = "wrong-uuid";
  invalid.storage.root = join(dir, "must-not-create");
  invalid.metadata.socket = join(invalid.storage.root, "metadata.sock");
  const bad = join(dir, "invalid.json");
  writeFileSync(bad, JSON.stringify(invalid));
  const resultBad = spawnSync(
    process.execPath,
    ["dist/cli.js", "status", bad],
    { encoding: "utf8" },
  );
  assert.equal(resultBad.status, 1);
  assert.equal(existsSync(invalid.storage.root), false);
  console.log(
    JSON.stringify({
      doctor: true,
      persistentPause: true,
      cancel: true,
      retry: true,
      inspectRedacted: true,
      metadataAuth: true,
      socketMode: "0600",
      wrongMountFailClosed: true,
      productionChanged: false,
    }),
  );
} finally {
  if (server) {
    const exit = once(server, "exit");
    server.kill("SIGKILL");
    await exit;
  }
  rmSync(dir, { recursive: true, force: true });
}
