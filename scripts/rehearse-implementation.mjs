// Explicit live Build 004 acceptance. Retain every intent/ID on failure; never rerun blindly.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateConfig } from "../dist/config.js";
import { checkStorage, openRuntime } from "../dist/storage.js";
import { ghTransport, GitHubClient } from "../dist/github.js";
import { runIsolated } from "../dist/verification.js";
import { git } from "../dist/worktree.js";
const [mount, uuid, evidencePath, jobSeconds = "900"] = process.argv.slice(2);
if (
  !Number.isSafeInteger(Number(jobSeconds)) ||
  Number(jobSeconds) < 900 ||
  Number(jobSeconds) > 21600
)
  throw Error("Fixture job budget must be 900–21600 seconds");
if (!mount || !uuid || !evidencePath)
  throw Error(
    "Usage: rehearse-implementation MOUNT VERIFIED_UUID EVIDENCE_PATH",
  );
if (existsSync(evidencePath))
  throw Error(
    "Existing evidence requires reconciliation, not another execution",
  );
const repository = "talaniz/prime-mover-fixture";
const gh = new GitHubClient();
assert.equal(await gh.identity(), "talaniz");
async function api(method, endpoint, body) {
  const r = await ghTransport(method, endpoint, body);
  assert.ok(r.status >= 200 && r.status < 300, `GitHub HTTP ${r.status}`);
  return r.body;
}
const repo = await api("GET", `repos/${repository}`);
assert.equal(repo.private, true);
assert.equal(repo.default_branch, "main");
const activeFixtures = await api(
  "GET",
  `repos/${repository}/issues?state=open&labels=codex-ready&per_page=1`,
);
assert.ok(
  Array.isArray(activeFixtures) && activeFixtures.length === 0,
  "Retire prior fixture authorization before a new isolated rehearsal",
);
const config = JSON.parse(readFileSync("config.example.json"));
config.storage = { mount, uuid, root: join(mount, "codex-work") };
config.metadata.socket = join(
  config.storage.root,
  "data",
  "prime-mover",
  "metadata.sock",
);
checkStorage(validateConfig(config));
const root = mkdtempSync(
  join(config.storage.root, "implementation-rehearsal-"),
);
config.storage.root = root;
config.metadata.socket = join(root, "metadata.sock");
config.metadata.tokenFile = join(root, "unused-token");
config.pollSeconds = 1;
config.limits.turnSeconds = 300;
config.limits.jobSeconds = Number(jobSeconds);
config.projects = [
  {
    ...config.projects[0],
    id: "fixture",
    name: "Implementation fixture",
    repository,
    setup: [],
    verify: [["node", "--test", "test/greeting.test.mjs"]],
    allowedPaths: ["greeting.mjs", "test/greeting.test.mjs"],
  },
];
validateConfig(config);
const configPath = join(root, "config.local.json");
writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
const evidence = {
  repository,
  root,
  configPath,
  startedAt: new Date().toISOString(),
  phase: "prepared",
  productionChanged: false,
};
const save = () =>
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), {
    mode: 0o600,
  });
save();
function state(action) {
  const store = openRuntime(config);
  try {
    return action(store);
  } finally {
    store.close();
  }
}
function command(name, ...args) {
  const result = spawnSync(
    process.execPath,
    ["dist/cli.js", name, configPath, ...args],
    { encoding: "utf8", timeout: 900000 },
  );
  if (result.status !== 0) {
    evidence.phase = "blocked";
    evidence.command = name;
    evidence.exitCode = result.status;
    evidence.jobs = state((s) =>
      s.jobs().map((j) => ({
        id: j.id,
        stage: j.stage,
        blockCode: j.blockCode,
        threadId: j.activeThreadId,
        turnId: j.activeTurnId,
        leaseHeld: !!j.leaseOwner,
      })),
    );
    save();
    console.log(JSON.stringify(evidence));
    throw Error(`Fixture ${name} failed; inspect retained state`);
  }
  return JSON.parse(result.stdout);
}
const body =
  "## Objective\nAdd a dependency-free greeting module for the supervised Prime Mover acceptance fixture.\n## Scope\nOnly greeting.mjs and test/greeting.test.mjs. No dependencies, services, other tasks, commits, pushes, PR creation, merge, or deployment by the implementation agent; the coordinator owns publication.\n## Acceptance criteria\nExport greet(name) from greeting.mjs. For a nonempty string, trim outer whitespace and return exactly Hello, NAME! (for example Hello, Ada!). Reject non-string inputs and empty or whitespace-only strings with TypeError. Preserve internal whitespace. Include meaningful node:test cases for normal input, trimming, and invalid input.\n## Verification\nRun node --test test/greeting.test.mjs. The coordinator also independently invokes greet with normal, trimmed, empty, whitespace, null, number and array inputs.";
evidence.issueIntent = {
  title: `Build 004 supervised implementation ${evidence.startedAt}`,
};
save();
const issue = await api("POST", `repos/${repository}/issues`, {
  title: evidence.issueIntent.title,
  body,
});
evidence.issue = issue.number;
evidence.issueUrl = issue.html_url;
evidence.phase = "issue-created";
save();
await api("POST", `repos/${repository}/issues/${issue.number}/labels`, {
  labels: ["codex-ready"],
});
for (let attempt = 0; attempt < 15; attempt++) {
  state((s) => s.recordPoll("fixture", null, null, 0));
  command("poll");
  if (
    state((s) =>
      s.jobs().some((j) => j.issue === issue.number && j.stage === "queued"),
    )
  )
    break;
  await new Promise((r) => setTimeout(r, 2000));
}
const job = state((s) => s.jobs().find((j) => j.issue === issue.number));
assert.equal(job?.stage, "queued");
evidence.jobId = job.id;
evidence.phase = "implementation-running";
save();
console.log(
  JSON.stringify({
    phase: evidence.phase,
    issue: issue.number,
    jobId: job.id,
    root,
  }),
);
const result = command("run-once");
assert.equal(result.result, "pr-open");
const completed = state((s) => s.job(job.id));
assert.equal(completed.stage, "pr-open");
assert.equal(completed.leaseOwner, null);
assert.equal(completed.activeTurnId, null);
const operations = state((s) => s.operations(job.id));
const plan = operations.find((o) => o.key === "workspace-plan").result;
const task = operations.find((o) => o.key === "implementation-0:thread").result;
const turn = operations.find((o) => o.key === "implementation-0:turn").result;
evidence.threadId = task.threadId;
evidence.turnId = turn.turnId;
evidence.base = plan.baseSha;
evidence.head = (await git(plan.cwd, ["rev-parse", "HEAD"])).trim();
evidence.branch = plan.branch;
evidence.cwd = plan.cwd;
evidence.pr = completed.prNumber;
const pr = await api("GET", `repos/${repository}/pulls/${completed.prNumber}`);
assert.equal(pr.draft, true);
assert.equal(pr.state, "open");
assert.equal(pr.head.sha, evidence.head);
assert.equal(pr.base.sha, evidence.base);
evidence.prUrl = pr.html_url;
assert.equal(
  (
    await git(plan.cwd, ["rev-list", "--count", `${plan.baseSha}..HEAD`])
  ).trim(),
  "1",
);
const paths = (
  await git(plan.cwd, ["diff", "--name-only", plan.baseSha, "HEAD"])
)
  .trim()
  .split("\n")
  .sort();
assert.deepEqual(paths, ["greeting.mjs", "test/greeting.test.mjs"]);
const check = await runIsolated(
  plan.cwd,
  [
    "node",
    "--input-type=module",
    "-e",
    `import assert from 'node:assert/strict';import {greet} from './greeting.mjs';assert.equal(greet('Ada'),'Hello, Ada!');assert.equal(greet('  Ada  '),'Hello, Ada!');assert.equal(greet('Ada Lovelace'),'Hello, Ada Lovelace!');for(const value of ['', '   ', null, 42, []])assert.throws(()=>greet(value),TypeError);console.log('INDEPENDENT_FIXTURE_ACCEPTANCE_OK');`,
  ],
  { timeoutMs: 10000, gitCommonDir: plan.bare },
);
assert.equal(check.status, "passed", check.stderr);
assert.equal(check.stdout.trim(), "INDEPENDENT_FIXTURE_ACCEPTANCE_OK");
evidence.independentAcceptance = true;
evidence.verification = operations
  .filter((o) => o.kind === "verification")
  .map((o) => ({
    key: o.key,
    status: o.result.result.status,
    exitCode: o.result.result.exitCode,
    artifact: o.result.artifact,
  }));
evidence.phase = "complete";
evidence.completedAt = new Date().toISOString();
save();
console.log(JSON.stringify(evidence));
