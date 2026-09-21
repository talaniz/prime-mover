import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { GitHubClient } from "../../dist/github.js";
test("HTTP fixture exercises paginated events/comments and exact acknowledgment JSON", async (t) => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let payload = "";
    for await (const chunk of req) payload += chunk;
    requests.push({ url: req.url, method: req.method, payload });
    res.setHeader("Content-Type", "application/json");
    const url = new URL(req.url, "http://localhost");
    if (req.method === "POST") {
      res.statusCode = 201;
      res.end(JSON.stringify({ id: 88 }));
    } else if (url.pathname.endsWith("/events")) {
      const page = url.searchParams.get("page");
      if (page === "1")
        res.setHeader(
          "Link",
          '<https://api.github.com/repos/owner/repo/issues/1/events?per_page=100&page=2>; rel="next"',
        );
      res.end(
        JSON.stringify([
          {
            id: Number(page),
            actor: { login: page === "1" ? "outsider" : "maintainer" },
            label: { name: "codex-ready" },
            event: "labeled",
            created_at: "2026-09-20T00:00:00Z",
          },
        ]),
      );
    } else if (url.pathname.endsWith("/comments"))
      res.end(
        JSON.stringify([
          { id: 88, user: { login: "worker" }, body: "Exact acknowledgment" },
        ]),
      );
    else {
      res.statusCode = 429;
      res.setHeader("Retry-After", "90");
      res.end(JSON.stringify({ message: "sensitive remote diagnostics" }));
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const port = server.address().port;
  const client = new GitHubClient(async (method, endpoint, body) => {
    const res = await fetch(`http://127.0.0.1:${port}/${endpoint}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body: await res.json(),
    };
  });
  const first = await client.events("owner/repo", 1);
  assert.equal(first.next, "2");
  assert.equal(
    (await client.events("owner/repo", 1, first.next)).items[0].actor,
    "maintainer",
  );
  assert.equal(
    await client.comment("owner/repo", 1, "Exact acknowledgment"),
    "88",
  );
  assert.equal(
    (await client.comments("owner/repo", 1)).items[0].body,
    "Exact acknowledgment",
  );
  assert.deepEqual(
    JSON.parse(requests.find((r) => r.method === "POST").payload),
    { body: "Exact acknowledgment" },
  );
  await assert.rejects(
    client.issues("owner/repo"),
    (e) =>
      e.kind === "rate-limited" &&
      !e.message.includes("sensitive") &&
      e.retryAt > Date.now() + 80000,
  );
});
