import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, target, acceptance } from "../support/review-fixture.mjs";
import { CodeReviewRound } from "../../dist/code-review.js";
test("E2E round starts a distinct workflow reviewer only after code sign-off and publishes its actual evidence", async (t) => {
  const f = fixture(t),
    config = JSON.parse(readFileSync("config.example.json"));
  const ctx = {
    lease: f.lease,
    signal: new AbortController().signal,
    assertActive: () => f.store.assertWorker(f.lease),
  };
  let starts = 0,
    published;
  const agent = {
    reuseTask() {
      throw Error("First actual E2E task must not reuse the code reviewer");
    },
    async start(ctx, input) {
      starts++;
      assert.equal(input.role, "e2e-review");
      assert.match(input.prompt, /actual.*workflow/i);
      assert.match(input.prompt, /failure/i);
      assert.ok(input.outputSchema.properties.workflows);
      return { key: input.key, threadId: "e2e-review", turnId: "e2e-review-1" };
    },
    async observe() {
      return "completed";
    },
    async result() {
      const { taskId, turnId, reportUrl, ...raw } = f.evidence();
      return JSON.stringify(raw);
    },
  };
  // Fixture pre-records the independent E2E task identity; start returns that owned identity.
  const inputs = {
    async collect() {
      return {
        target,
        diff: "combined",
        commits: [{ sha: target.head, diff: "commit" }],
      };
    },
  };
  const round = new CodeReviewRound(
    f.store,
    config,
    {
      async authorize() {
        return { decision: { contract: { acceptance } } };
      },
    },
    inputs,
    agent,
    {
      async publish(ctx, key, pr, body) {
        published = body;
        return f.evidence().reportUrl;
      },
    },
    { role: "e2e-review", pollMs: 1 },
  );
  const report = await round.run(
    ctx,
    { cwd: "/isolated", baseSha: target.base },
    f.project,
    "e2e-review-1",
  );
  assert.equal(starts, 1);
  assert.match(published, /Independent e2e review/i);
  assert.equal(report.workflows.length, 2);
  assert.equal(f.e2e.requireSignoff(f.id, target).taskId, "e2e-review");
  const again = await round.run(
    ctx,
    { cwd: "/isolated", baseSha: target.base },
    f.project,
    "e2e-review-1",
  );
  assert.equal(again.turnId, report.turnId);
  assert.equal(starts, 1);
});
