// Explicit supervised review acceptance in the owner-controlled private fixture.
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateConfig } from "../dist/config.js";
import { openRuntime } from "../dist/storage.js";
import { GitHubClient } from "../dist/github.js";
import { Intake } from "../dist/intake.js";
import { Worktrees, git } from "../dist/worktree.js";
import { Publication, GitHubPulls } from "../dist/publication.js";
import { CommandEvidence } from "../dist/command-evidence.js";
import { Scheduler } from "../dist/scheduler.js";
import { runIsolated } from "../dist/verification.js";
const [mount, uuid, evidencePath] = process.argv.slice(2);
if (!mount || !uuid || !evidencePath)
  throw Error("Usage: rehearse-review MOUNT VERIFIED_UUID EVIDENCE");
if (
  existsSync(evidencePath) ||
  existsSync(`${evidencePath}.implementation.json`)
)
  throw Error(
    "Existing evidence requires reconciliation; do not create another fixture",
  );
const evidence = {
  phase: "implementation-preparing",
  repository: "talaniz/prime-mover-fixture",
  startedAt: new Date().toISOString(),
  productionChanged: false,
};
const save = () =>
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), {
    mode: 0o600,
  });
save();
function command(argv, label, timeout = 900000) {
  const result = spawnSync(process.execPath, argv, {
    encoding: "utf8",
    timeout,
  });
  writeFileSync(
    `${evidencePath}.${label}.log`,
    result.stdout + "\n" + result.stderr,
    { mode: 0o600 },
  );
  if (result.status !== 0) {
    evidence.phase = `${label}-blocked`;
    evidence.exitCode = result.status;
    save();
    throw Error(`${label} failed; inspect retained evidence`);
  }
  return result.stdout;
}
command(
  [
    "scripts/rehearse-implementation.mjs",
    mount,
    uuid,
    `${evidencePath}.implementation.json`,
    "21600",
  ],
  "implementation",
);
const implementation = JSON.parse(
  readFileSync(`${evidencePath}.implementation.json`),
);
assert.equal(implementation.phase, "complete");
Object.assign(evidence, {
  jobId: implementation.jobId,
  issue: implementation.issue,
  pr: implementation.pr,
  prUrl: implementation.prUrl,
  configPath: implementation.configPath,
  implementationThread: implementation.threadId,
  initialHead: implementation.head,
  base: implementation.base,
  phase: "seed-preparing",
});
save();
const config = validateConfig(JSON.parse(readFileSync(evidence.configPath))),
  store = openRuntime(config),
  github = new GitHubClient();
assert.equal(await github.identity(), "talaniz");
const intake = new Intake(store, github),
  trees = new Worktrees(config.storage.root, undefined, config.gitAuthor),
  publication = new Publication(
    store,
    trees,
    new GitHubPulls(),
    undefined,
    (id) => intake.authorize(id),
  );
try {
  await intake.authorize(evidence.jobId);
  const plan = store
    .operations(evidence.jobId)
    .find((o) => o.key === "workspace-plan").result;
  const deadline = store
    .operations(evidence.jobId)
    .find((o) => o.key === "implementation-budget").input.deadline;
  const lease = store.claimCodeReview(
    evidence.jobId,
    "live-seed-coordinator",
    30000,
  );
  const result = await new Scheduler(store, "live-seed-coordinator").runClaimed(
    lease,
    async (context) => {
      store.operation(lease, "live-review-seed", "acceptance-seed", {
        defect: "Output preserves outer whitespace despite trim contract",
        files: ["greeting.mjs", "test/greeting.test.mjs"],
      });
      store.transition(lease, "code-fixes");
      writeFileSync(
        join(plan.cwd, "greeting.mjs"),
        "export function greet(name) {\n  if (typeof name !== 'string' || !name.trim()) throw new TypeError('Name required');\n  return `Hello, ${name}!`;\n}\n",
      );
      writeFileSync(
        join(plan.cwd, "test/greeting.test.mjs"),
        "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { greet } from '../greeting.mjs';\ntest('normal name', () => assert.equal(greet('Ada'), 'Hello, Ada!'));\ntest('invalid name', () => assert.throws(() => greet(null), TypeError));\n",
      );
      const head = await publication.commit(
        context,
        plan,
        config.projects[0],
        "seed-review-defect",
      );
      evidence.seedHead = head;
      evidence.phase = "seed-committed";
      save();
      store.transition(lease, "verifying");
      const commandEvidence = new CommandEvidence(store, config, intake),
        checks = [];
      for (const [i, argv] of config.projects[0].verify.entries()) {
        const check = await commandEvidence.run(
          context,
          plan,
          argv,
          `verify:${head}:${i}`,
          "verification",
          deadline,
        );
        assert.equal(check.result.status, "passed");
        checks.push({
          argv,
          exitCode: 0,
          headSha: head,
          artifact: check.artifact,
          startedAt: check.result.startedAt,
          completedAt: check.result.completedAt,
        });
      }
      const bug = await runIsolated(
        plan.cwd,
        [
          "node",
          "--input-type=module",
          "-e",
          "import assert from 'node:assert/strict';import {greet} from './greeting.mjs';assert.notEqual(greet('  Ada  '),'Hello, Ada!');console.log('SEEDED_DEFECT_CONFIRMED');",
        ],
        { timeoutMs: 10000, gitCommonDir: plan.bare },
      );
      assert.equal(bug.status, "passed");
      assert.equal(bug.stdout.trim(), "SEEDED_DEFECT_CONFIRMED");
      const pr = await publication.publish(
        context,
        plan,
        config.projects[0],
        checks,
        { title: "Review fixture", body: "Supervised seeded defect" },
      );
      assert.equal(pr.number, evidence.pr);
      store.completeOperation(lease, "live-review-seed", {
        head,
        defectConfirmed: true,
      });
      store.finishImplementation(lease, pr.number);
    },
  );
  assert.equal(result, "pr-open");
  evidence.phase = "review-running";
  save();
  console.log(
    JSON.stringify({
      phase: evidence.phase,
      jobId: evidence.jobId,
      pr: evidence.prUrl,
      seedHead: evidence.seedHead,
    }),
  );
  command(
    ["dist/cli.js", "code-review", evidence.configPath, evidence.jobId],
    "code-review",
    config.limits.jobSeconds * 1000,
  );
  const job = store.job(evidence.jobId);
  assert.equal(job.stage, "e2e-review");
  assert.equal(job.leaseOwner, null);
  assert.equal(job.activeTurnId, null);
  const reports = store
    .operations(job.id)
    .filter((o) => o.kind === "code-review-report" && o.status === "done")
    .map((o) => o.result);
  assert.ok(reports.length >= 2);
  assert.equal(reports[0].verdict, "changes-requested");
  assert.ok(reports[0].findings.length > 0);
  assert.equal(reports.at(-1).verdict, "sign-off");
  assert.equal(reports[0].taskId, reports.at(-1).taskId);
  assert.notEqual(reports[0].taskId, evidence.implementationThread);
  const head = (await git(plan.cwd, ["rev-parse", "HEAD"])).trim();
  assert.notEqual(head, evidence.seedHead);
  assert.equal(reports.at(-1).head, head);
  const check = await runIsolated(
    plan.cwd,
    [
      "node",
      "--input-type=module",
      "-e",
      "import assert from 'node:assert/strict';import {greet} from './greeting.mjs';assert.equal(greet('  Ada  '),'Hello, Ada!');assert.equal(greet('Ada Lovelace'),'Hello, Ada Lovelace!');for(const name of ['', ' ', null, 42, []])assert.throws(()=>greet(name),TypeError);console.log('REVIEW_CORRECTION_ACCEPTANCE_OK');",
    ],
    { timeoutMs: 10000, gitCommonDir: plan.bare },
  );
  assert.equal(check.status, "passed");
  assert.equal(check.stdout.trim(), "REVIEW_CORRECTION_ACCEPTANCE_OK");
  const pr = (
    await new GitHubPulls().list(evidence.repository, plan.branch)
  ).find((p) => p.number === evidence.pr);
  assert.equal(pr.head, head);
  assert.equal(pr.base, evidence.base);
  assert.equal(pr.state, "open");
  Object.assign(evidence, {
    phase: "complete",
    finalHead: head,
    reports: reports.map((r) => ({
      head: r.head,
      taskId: r.taskId,
      turnId: r.turnId,
      verdict: r.verdict,
      reportUrl: r.reportUrl,
    })),
    triage: store
      .operations(job.id)
      .filter((o) => o.kind === "review-disposition")
      .map((o) => o.result),
    independentAcceptance: true,
    completedAt: new Date().toISOString(),
  });
  save();
  console.log(JSON.stringify(evidence));
} finally {
  store.close();
}
