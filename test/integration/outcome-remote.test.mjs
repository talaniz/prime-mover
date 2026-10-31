import test from "node:test";
import assert from "node:assert/strict";
import { readRemoteOutcome } from "../../dist/outcome.js";
const raw = () => ({
  number: 3,
  state: "closed",
  merged: true,
  merged_at: "2026-09-22T00:00:00Z",
  merge_commit_sha: "c".repeat(40),
  head: { sha: "b".repeat(40), repo: { full_name: "owner/repo" } },
  base: { ref: "main", repo: { full_name: "owner/repo" } },
});
test("terminal observations require only a read and ignore stale mergeability/base SHA", async () => {
  const calls = [];
  const result = await readRemoteOutcome("owner/repo", 3, async (...args) => {
    calls.push(args);
    return { status: 200, body: { ...raw(), mergeable: null } };
  });
  assert.deepEqual(calls, [["GET", "repos/owner/repo/pulls/3"]]);
  assert.equal(result.state, "merged");
});
test("invalid or unavailable remote outcomes fail closed without reflecting response text", async () => {
  for (const body of [
    null,
    {},
    { ...raw(), number: 4 },
    { ...raw(), merged: "true" },
    { ...raw(), merged_at: null },
    { ...raw(), head: { ...raw().head, repo: { full_name: "foreign/repo" } } },
  ])
    await assert.rejects(
      readRemoteOutcome("owner/repo", 3, async () => ({ status: 200, body })),
    );
  await assert.rejects(
    readRemoteOutcome("owner/repo", 3, async () => ({
      status: 403,
      body: { message: "secret" },
    })),
    (e) => !e.message.includes("secret"),
  );
});
