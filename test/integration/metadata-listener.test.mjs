import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  writeFile,
  readFile,
  symlink,
  lstat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
const moduleUrl = new URL("../../dist/metadata-listener.js", import.meta.url)
  .href;
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), "pm-metadata-listener-"));
  const children = [];
  t.after(async () => {
    for (const p of children)
      if (p.exitCode === null && p.signalCode === null) {
        const done = once(p, "exit");
        p.kill("SIGKILL");
        await done;
      }
    await rm(dir, { recursive: true, force: true });
  });
  async function start(socket = join(dir, "metadata.sock")) {
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import http from 'node:http';import {listenMetadata} from ${JSON.stringify(moduleUrl)};const server=http.createServer((q,r)=>r.end('ok'));await listenMetadata(server,process.argv[1]);console.log('ready');process.once('SIGTERM',()=>server.close());`,
        socket,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    children.push(child);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Listener startup timeout")),
        5000,
      );
      let stderr = "";
      child.stderr.on("data", (b) => (stderr += b));
      child.stdout.once("data", () => {
        clearTimeout(timer);
        resolve({ child, ready: true, stderr });
      });
      child.once("exit", () => {
        clearTimeout(timer);
        resolve({ child, ready: false, stderr });
      });
    });
  }
  return { dir, socket: join(dir, "metadata.sock"), start };
}
const get = (socket) =>
  new Promise((resolve, reject) => {
    http
      .get({ socketPath: socket, path: "/" }, (r) => {
        r.resume();
        r.on("end", () => resolve(r.statusCode));
      })
      .on("error", reject);
  });
test("metadata listener recovers stale socket after SIGKILL and permits only one concurrent restart", async (t) => {
  const { socket, start } = await setup(t);
  const original = await start();
  assert.equal(original.ready, true);
  const exit = once(original.child, "exit");
  original.child.kill("SIGKILL");
  await exit;
  assert.equal((await lstat(socket)).isSocket(), true);
  const attempts = await Promise.all([start(), start()]);
  assert.equal(
    attempts.filter((a) => a.ready).length,
    1,
    "exactly one replacement must start",
  );
  assert.equal(await get(socket), 200);
  assert.equal((await lstat(socket)).mode & 0o777, 0o600);
});
test("second metadata process cannot remove an active listener socket", async (t) => {
  const { socket, start } = await setup(t);
  assert.equal((await start()).ready, true);
  assert.equal((await start()).ready, false);
  assert.equal(await get(socket), 200);
});
test("metadata startup preserves a regular file or symlink at the socket path", async (t) => {
  const { dir, socket, start } = await setup(t);
  await writeFile(socket, "keep");
  assert.equal((await start()).ready, false);
  assert.equal(await readFile(socket, "utf8"), "keep");
  await rm(socket);
  const target = join(dir, "target");
  await writeFile(target, "private");
  await symlink(target, socket);
  assert.equal((await start()).ready, false);
  assert.equal(await readFile(target, "utf8"), "private");
  assert.equal((await lstat(socket)).isSymbolicLink(), true);
});
test("metadata startup preserves an active socket owned by a listener without the lock protocol", async (t) => {
  const { socket, start } = await setup(t);
  const other = http.createServer((q, r) => r.end("other"));
  await new Promise((r) => other.listen(socket, r));
  t.after(() => new Promise((r) => other.close(r)));
  assert.equal((await start()).ready, false);
  assert.equal(await get(socket), 200);
});
test("metadata startup refuses a symlink lock without altering its target", async (t) => {
  const { dir, socket, start } = await setup(t);
  const target = join(dir, "lock-target");
  await writeFile(target, "keep", { mode: 0o600 });
  await symlink(target, `${socket}.lock`);
  assert.equal((await start()).ready, false);
  assert.equal(await readFile(target, "utf8"), "keep");
});
