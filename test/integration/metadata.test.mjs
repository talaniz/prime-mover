import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";
import { metadataSnapshot, metadataServer } from "../../dist/metadata.js";
const projects = JSON.parse(readFileSync("config.example.json")).projects;
const secret = "b".repeat(64);
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "pm-metadata-"));
  const store = new Store(join(dir, "store.db"), () => 1000);
  store.seedProjects(projects);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, socket: join(dir, "s.sock") };
}
function get(socket, path = "/v1/projects", token = secret, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: socket,
        path,
        method,
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let body = "";
        res.on("data", (b) => (body += b));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}
test("metadata snapshot shows defaults, empty work, pause, polling age and safe blockers", (t) => {
  const { store } = setup(t);
  store.updatePoll("prime-mover", "checkpoint", null);
  store.setPaused(true);
  const snapshot = metadataSnapshot(store, 120, 200000);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.intakePaused, true);
  assert.equal(snapshot.projects.length, 2);
  const p = snapshot.projects.find((p) => p.id === "prime-mover");
  assert.equal(p.queuedJobs, 0);
  assert.equal(p.activeJob, null);
  assert.equal(p.pollState, "stale");
  assert.equal(
    snapshot.projects.find((p) => p.id === "doom-dashboard").pollState,
    "never-polled",
  );
  assert.equal(snapshot.observedAt, new Date(200000).toISOString());
});
test("metadata rejects unauthorized, unknown project and mutation requests and never writes jobs", async (t) => {
  const { store, socket } = setup(t);
  const id = store.enqueue("prime-mover", 1, {
    secret: "DO_NOT_EXPOSE",
    body: "private issue",
  });
  const lease = store.claim("worker", 1000);
  store.blockAndRelease(lease, "DO_NOT_EXPOSE");
  const server = metadataServer(store, secret, 120);
  await new Promise((r) => server.listen(socket, r));
  t.after(() => new Promise((r) => server.close(r)));
  const before = store.events(id).length;
  assert.equal((await get(socket, undefined, "bad")).status, 401);
  assert.equal((await get(socket, "/v1/projects/missing")).status, 404);
  assert.equal((await get(socket, "/v1/projects", secret, "POST")).status, 405);
  const r = await get(socket);
  assert.equal(r.status, 200);
  assert.equal(r.headers["cache-control"], "no-store");
  assert.equal(r.body.projects.length, 2);
  assert.doesNotMatch(
    JSON.stringify(r.body),
    /DO_NOT_EXPOSE|private issue|maintainers|setup|allowedPaths/,
  );
  assert.equal(
    (await get(socket, "/v1/projects/prime-mover")).body.projects.length,
    1,
  );
  assert.equal(store.events(id).length, before);
  assert.equal(store.jobs().length, 1);
});
