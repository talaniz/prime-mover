import { metadataSnapshot } from "../../dist/metadata.js";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { completed } from "../support/outcome-fixture.mjs";
test("merged readiness-blocked workflow completes exactly once while paused", (t) => {
  const f = completed(t);
  f.store.revokeReadiness(f.id, "readiness-check-failed");
  f.store.setPaused(true);
  const operations = f.store.operations(f.id),
    notifications = f.store.notifications(f.id);
  assert.equal(f.store.reconcileOutcome(f.id, f.outcome, false), "merged");
  assert.equal(f.store.job(f.id).stage, "blocked");
  assert.equal(f.store.reconcileOutcome(f.id, f.outcome), "merged");
  assert.equal(f.store.reconcileOutcome(f.id, f.outcome), "merged");
  assert.equal(f.store.job(f.id).blockCode, null);
  assert.deepEqual(f.store.operations(f.id), operations);
  assert.deepEqual(f.store.notifications(f.id), notifications);
  assert.equal(
    f.store.events(f.id).filter((e) => e.kind === "remote-outcome").length,
    1,
  );
});
test("closed PR is an outcome while open conflict remains blocked", (t) => {
  const f = completed(t);
  f.store.revokeReadiness(f.id, "readiness-check-failed");
  assert.equal(
    f.store.reconcileOutcome(f.id, {
      ...f.outcome,
      state: "open",
      mergedAt: null,
      mergeCommit: null,
    }),
    "open",
  );
  assert.equal(f.store.job(f.id).stage, "blocked");
  assert.equal(
    f.store.reconcileOutcome(f.id, {
      ...f.outcome,
      state: "closed",
      mergedAt: null,
      mergeCommit: null,
    }),
    "closed",
  );
});
test("wrong identity, changed head, stale evidence and malformed merge fail without mutation", (t) => {
  const f = completed(t);
  const before = f.store.events(f.id);
  for (const change of [
    { repository: "other/repo" },
    { number: 4 },
    { head: "d".repeat(40) },
    { baseBranch: "other" },
    { observedAt: 0 },
    { observedAt: Date.now() + 60000 },
    { mergedAt: null },
    { mergeCommit: null },
    { state: "bogus" },
  ]) {
    assert.throws(() =>
      f.store.reconcileOutcome(f.id, { ...f.outcome, ...change }),
    );
    assert.equal(f.store.job(f.id).stage, "ready");
  }
  assert.deepEqual(f.store.events(f.id), before);
});

test("completed newer work does not hide another blocked job", (t) => {
  const f = completed(t);
  f.store.enqueue(f.project.id, 2, {}, 0, "operator");
  f.store.reconcileOutcome(f.id, f.outcome);
  assert.ok(metadataSnapshot(f.store, 120).projects[0].blocker);
});

test("unrelated blocker and active or pending reservations cannot be cleared", (t) => {
  const f = completed(t);
  f.store.revokeReadiness(f.id, "operator");
  assert.throws(
    () => f.store.reconcileOutcome(f.id, f.outcome),
    /previously ready/,
  );
  assert.equal(f.store.job(f.id).blockCode, "operator");
});
test("a worker reservation racing a terminal observation is refused", (t) => {
  const f = completed(t);
  // Review revalidation claims the ready job before the observation can commit.
  f.store.revokeReadiness(f.id, "readiness-check-failed");
  // Simulate a competing persisted reservation using an isolated fixture database.
  const db = new DatabaseSync(f.databasePath);
  db.prepare("UPDATE jobs SET lease_owner=? WHERE id=?").run("other", f.id);
  db.close();
  assert.throws(
    () => f.store.reconcileOutcome(f.id, f.outcome),
    /reservations/,
  );
});

test("terminal generation is not re-ingested when its issue remains open and labeled", async (t) => {
  const { Intake } = await import("../../dist/intake.js");
  const f = completed(t);
  f.store.reconcileOutcome(f.id, f.outcome);
  let discoveries = 0;
  const api = {
    issues: async () => {
      discoveries++;
      return {
        items: [{ repository: f.project.repository, number: 1 }],
        next: null,
      };
    },
    issue: async () => {
      throw Error("terminal issue must not be reauthorized");
    },
    comment: async () => {
      throw Error("no repost");
    },
  };
  await new Intake(f.store, api).poll();
  assert.equal(discoveries, 1);
  assert.equal(f.store.jobs().length, 1);
  assert.equal(f.store.job(f.id).stage, "merged");
  assert.equal(f.store.projects()[0].blockCode, null);
});
test("pending operation blocks outcome recording even without an active lease", (t) => {
  const f = completed(t);
  const db = new DatabaseSync(f.databasePath);
  db.prepare("INSERT INTO operations VALUES (?,?,?,?,'pending',NULL,?,?)").run(
    f.id,
    "uncertain",
    "turn-start",
    "{}",
    Date.now(),
    Date.now(),
  );
  db.close();
  assert.throws(
    () => f.store.reconcileOutcome(f.id, f.outcome),
    /reservations/,
  );
  assert.equal(f.store.job(f.id).stage, "ready");
});
