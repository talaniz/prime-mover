import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient } from "../../dist/github.js";
const raw = {
  number: 4,
  title: "Task",
  body: "Body",
  state: "open",
  labels: [{ name: "codex-ready" }],
  updated_at: "2026-09-20T00:00:00Z",
};
test("maps GitHub issues and follows only bounded page cursors", async () => {
  const calls = [];
  const client = new GitHubClient(async (method, path) => {
    calls.push([method, path]);
    return {
      status: 200,
      headers: {
        link: '<https://api.github.com/repos/owner/repo/issues?state=all&labels=codex-ready&sort=updated&direction=asc&per_page=100&page=2>; rel="next"',
      },
      body: [raw, { ...raw, number: 5, pull_request: { url: "ignored" } }],
    };
  });
  const page = await client.issues("owner/repo");
  assert.equal(page.next, "2");
  assert.equal(page.items[0].repository, "owner/repo");
  assert.equal(page.items[1].isPullRequest, true);
  assert.match(calls[0][1], /page=1/);
  await assert.rejects(
    client.issues("owner/repo", "https://attacker.invalid"),
    /cursor/,
  );
});
test("missing actors remain absent evidence; unrelated events are ignored", async () => {
  const c = new GitHubClient(async () => ({
    status: 200,
    headers: {},
    body: [
      {
        id: 123,
        event: "labeled",
        label: { name: "codex-ready" },
        actor: null,
        created_at: "2026-09-20T00:00:00Z",
      },
      { id: 124, event: "assigned" },
    ],
  }));
  const page = await c.events("owner/repo", 1);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].actor, "");
  assert.equal(page.items[0].id, "123");
});
for (const [status, kind] of [
  [401, "authentication"],
  [403, "forbidden"],
  [429, "rate-limited"],
  [500, "unavailable"],
])
  test(`HTTP ${status} is classified without leaking response`, async () => {
    const c = new GitHubClient(async () => ({
      status,
      headers: {},
      body: { message: "secret-credential" },
    }));
    await assert.rejects(
      c.issues("owner/repo"),
      (e) => e.kind === kind && !e.message.includes("secret"),
    );
  });
test("rate-limit backoff respects retry-after and exhausted primary limit", async () => {
  for (const headers of [
    { "retry-after": "120" },
    {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.ceil(Date.now() / 1000) + 120),
    },
  ]) {
    const c = new GitHubClient(async () => ({
      status: 403,
      headers,
      body: {},
    }));
    await assert.rejects(
      c.issues("owner/repo"),
      (e) => e.kind === "rate-limited" && e.retryAt > Date.now() + 110000,
    );
  }
});
test("malformed IDs, unsafe pagination hosts and malformed success fail closed", async () => {
  const c = new GitHubClient(async () => ({
    status: 200,
    headers: { link: '<https://attacker.invalid/?page=2>; rel="next"' },
    body: [raw],
  }));
  await assert.rejects(c.issues("owner/repo"), /invalid-response/);
  const d = new GitHubClient(async () => ({
    status: 200,
    headers: {},
    body: [{ ...raw, number: 0 }],
  }));
  await assert.rejects(d.issues("owner/repo"), /invalid-response/);
});
test("posts exact supplied comment body and returns validated identity", async () => {
  const calls = [];
  const c = new GitHubClient(async (m, p, b) => {
    calls.push({ m, p, b });
    return { status: 201, headers: {}, body: { id: 21 } };
  });
  assert.equal(await c.comment("owner/repo", 4, "ack body"), "21");
  assert.deepEqual(calls, [
    {
      m: "POST",
      p: "repos/owner/repo/issues/4/comments",
      b: { body: "ack body" },
    },
  ]);
});
