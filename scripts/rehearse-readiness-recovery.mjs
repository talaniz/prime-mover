// Owner-controlled fixture status injection; this is not a production worker action.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validateConfig } from "../dist/config.js";
import { openRuntime } from "../dist/storage.js";
import { ghTransport, GitHubClient } from "../dist/github.js";
const [priorPath, evidencePath] = process.argv.slice(2);
if (!priorPath || !evidencePath || existsSync(evidencePath))
  throw Error(
    "Use completed E2E evidence and a new output; reconcile existing attempts",
  );
const prior = JSON.parse(readFileSync(priorPath));
assert.equal(prior.phase, "complete");
assert.equal(prior.repository, "talaniz/prime-mover-fixture");
const config = validateConfig(JSON.parse(readFileSync(prior.configPath))),
  store = openRuntime(config);
const evidence = {
  phase: "preparing",
  repository: prior.repository,
  jobId: prior.jobId,
  pr: prior.pr,
  head: prior.finalHead,
  startedAt: new Date().toISOString(),
  productionChanged: false,
};
const save = () =>
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), {
    mode: 0o600,
  });
function command(name, expected = 0, ...args) {
  const r = spawnSync(
    process.execPath,
    ["dist/cli.js", name, prior.configPath, prior.jobId, ...args],
    { encoding: "utf8", timeout: 300000 },
  );
  writeFileSync(
    `${evidencePath}.${name}.${expected}.log`,
    r.stdout + "\n" + r.stderr,
    { mode: 0o600 },
  );
  if (r.status !== expected) {
    Object.assign(evidence, {
      phase: `${name}-unexpected`,
      exitCode: r.status,
      stage: store.job(prior.jobId)?.stage,
    });
    save();
    throw Error("Unexpected command outcome; inspect retained evidence");
  }
  return r;
}
async function status(state) {
  const r = await ghTransport(
    "POST",
    `repos/${prior.repository}/statuses/${prior.finalHead}`,
    {
      state,
      context: "prime-mover-fixture/readiness-gate",
      description: `Supervised readiness recovery fixture: ${state}`,
      target_url: prior.prUrl,
    },
  );
  assert.equal(r.status, 201);
  evidence.status = state;
  save();
}
try {
  assert.equal(store.job(prior.jobId).stage, "ready");
  const before = store.operations(prior.jobId),
    turns = before
      .filter((o) => o.kind === "turn-start")
      .map((o) => o.result.turnId),
    deadline = before.find((o) => o.key === "implementation-budget").input
      .deadline;
  evidence.turnsBefore = turns;
  evidence.deadline = deadline;
  save();
  await status("failure");
  command("recheck-ready", 1);
  assert.equal(store.job(prior.jobId).stage, "blocked");
  assert.equal(store.job(prior.jobId).blockCode, "readiness-check-failed");
  evidence.phase = "revocation-verified";
  save();
  await status("success");
  command(
    "resume-code-review",
    0,
    "Fixture check restored; reconcile completed E2E task and reuse current-head reviews without new turns",
  );
  assert.equal(store.job(prior.jobId).stage, "e2e-review");
  command("e2e-review");
  command("recheck-ready");
  assert.equal(store.job(prior.jobId).stage, "ready");
  const after = store.operations(prior.jobId);
  assert.deepEqual(
    after.filter((o) => o.kind === "turn-start").map((o) => o.result.turnId),
    turns,
  );
  assert.equal(
    after.find((o) => o.key === "implementation-budget").input.deadline,
    deadline,
  );
  const notifications = store
    .notifications(prior.jobId)
    .filter((n) => n.kind.startsWith("ready:"));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].status, "done");
  const github = new GitHubClient();
  let cursor,
    comments = [];
  for (let page = 0; page < 100; page++) {
    const r = await github.comments(prior.repository, prior.pr, cursor);
    comments.push(...r.items);
    if (!r.next) break;
    cursor = r.next;
    if (page === 99) throw Error("Incomplete comment pages");
  }
  assert.equal(
    comments.filter((c) =>
      c.body.includes(`prime-mover-comment:${prior.jobId}:ready-`),
    ).length,
    1,
  );
  Object.assign(evidence, {
    phase: "complete",
    finalStage: "ready",
    newTurns: 0,
    budgetPreserved: true,
    notificationUrl: prior.notificationUrl,
    completedAt: new Date().toISOString(),
  });
  save();
  console.log(JSON.stringify(evidence));
} finally {
  store.close();
}
