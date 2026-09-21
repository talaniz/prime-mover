// Verify an already completed fixture without starting tasks or creating replacement work.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validateConfig } from "../dist/config.js";
import { openRuntime } from "../dist/storage.js";
import { GitHubClient } from "../dist/github.js";
import { GitHubPulls } from "../dist/publication.js";
import { runIsolated } from "../dist/verification.js";
const [priorPath, evidencePath] = process.argv.slice(2);
if (!priorPath || !evidencePath || existsSync(evidencePath))
  throw Error(
    "Usage: verify-mva-fixture IMPLEMENTATION_EVIDENCE NEW_EVIDENCE; reconcile existing output",
  );
const prior = JSON.parse(readFileSync(priorPath));
assert.equal(prior.phase, "complete");
assert.equal(prior.repository, "talaniz/prime-mover-fixture");
const config = validateConfig(JSON.parse(readFileSync(prior.configPath))),
  store = openRuntime(config);
const evidence = {
  phase: "final-acceptance",
  repository: prior.repository,
  jobId: prior.jobId,
  issue: prior.issue,
  pr: prior.pr,
  prUrl: prior.prUrl,
  configPath: prior.configPath,
  implementationHead: prior.head,
  startedAt: new Date().toISOString(),
  productionChanged: false,
};
const save = () =>
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), {
    mode: 0o600,
  });
function command(name) {
  const r = spawnSync(
    process.execPath,
    ["dist/cli.js", name, prior.configPath, prior.jobId],
    { encoding: "utf8", timeout: config.limits.jobSeconds * 1000 },
  );
  writeFileSync(`${evidencePath}.${name}.log`, r.stdout + "\n" + r.stderr, {
    mode: 0o600,
  });
  if (r.status !== 0) {
    Object.assign(evidence, {
      phase: `${name}-blocked`,
      exitCode: r.status,
      stage: store.job(prior.jobId)?.stage,
      blockCode: store.job(prior.jobId)?.blockCode,
    });
    save();
    throw Error(
      `${name} failed; inspect the retained runtime before continuing`,
    );
  }
  return r.stdout;
}
try {
  const initial = store.job(prior.jobId);
  assert.equal(initial.stage, "ready");
  assert.equal(initial.leaseOwner, null);
  assert.equal(initial.activeTurnId, null);
  assert.equal(store.hasPending(initial.id), false);
  save();
  const job = store.job(prior.jobId);
  assert.equal(job.stage, "ready");
  assert.equal(job.leaseOwner, null);
  assert.equal(job.activeTurnId, null);
  assert.equal(store.hasPending(job.id), false);
  const ops = store.operations(job.id),
    code = ops.filter((o) => o.kind === "code-review-report").at(-1).result,
    e2e = ops.filter((o) => o.kind === "e2e-review-report").at(-1).result,
    implementation = ops.find((o) => o.key === "implementation-0:thread").result
      .threadId;
  assert.equal(code.verdict, "sign-off");
  assert.equal(e2e.verdict, "sign-off");
  assert.equal(code.head, e2e.head);
  assert.equal(code.base, e2e.base);
  assert.notEqual(e2e.taskId, code.taskId);
  assert.notEqual(e2e.taskId, implementation);
  assert.ok(e2e.workflows.some((w) => w.kind === "success" && w.passed));
  assert.ok(e2e.workflows.some((w) => w.kind === "failure" && w.passed));
  assert.equal(e2e.limitations.length, 0);
  const notifications = store
    .notifications(job.id)
    .filter((n) => n.kind.startsWith("ready:"));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].status, "done");
  const plan = ops.find((o) => o.key === "workspace-plan").result;
  const check = await runIsolated(
    plan.cwd,
    [
      "node",
      "--input-type=module",
      "-e",
      "import assert from 'node:assert/strict';import {greet} from './greeting.mjs';assert.equal(greet('  Ada  '),'Hello, Ada!');assert.equal(greet('Ada Lovelace'),'Hello, Ada Lovelace!');for(const n of ['', ' ',null,42,[]])assert.throws(()=>greet(n),TypeError);console.log('E2E_INDEPENDENT_ACCEPTANCE_OK');",
    ],
    { timeoutMs: 10000, gitCommonDir: plan.bare },
  );
  assert.equal(check.status, "passed");
  assert.equal(check.stdout.trim(), "E2E_INDEPENDENT_ACCEPTANCE_OK");
  command("recheck-ready");
  assert.equal(store.job(job.id).stage, "ready");
  const github = new GitHubClient(),
    actor = await github.identity();
  let cursor,
    comments = [];
  for (let page = 0; page < 100; page++) {
    const r = await github.comments(job.repository, job.prNumber, cursor);
    comments.push(...r.items);
    if (!r.next) break;
    cursor = r.next;
    if (page === 99) throw Error("Comment pagination incomplete");
  }
  const ready = comments.filter(
    (c) => c.id === notifications[0].remoteId && c.actor === actor,
  );
  assert.equal(ready.length, 1);
  assert.match(ready[0].body, /@talaniz/);
  assert.ok(ready[0].body.includes(e2e.head));
  assert.ok(ready[0].body.includes(code.reportUrl));
  assert.ok(ready[0].body.includes(e2e.reportUrl));
  assert.equal(
    comments.filter((c) =>
      c.body.includes(`prime-mover-comment:${job.id}:ready-`),
    ).length,
    1,
  );
  const remote = await new GitHubPulls().readiness(
    job.repository,
    job.prNumber,
    "main",
    { head: e2e.head, base: e2e.base, commits: e2e.commits },
  );
  Object.assign(evidence, {
    phase: "complete",
    finalHead: e2e.head,
    base: e2e.base,
    codeReview: {
      taskId: code.taskId,
      turnId: code.turnId,
      url: code.reportUrl,
    },
    e2eReview: {
      taskId: e2e.taskId,
      turnId: e2e.turnId,
      url: e2e.reportUrl,
      workflows: e2e.workflows,
    },
    notificationUrl: `https://github.com/${job.repository}/pull/${job.prNumber}#issuecomment-${notifications[0].remoteId}`,
    independentAcceptance: true,
    recheckPassed: true,
    checks: remote.checks,
    completedAt: new Date().toISOString(),
  });
  save();
  console.log(JSON.stringify(evidence));
} finally {
  store.close();
}
