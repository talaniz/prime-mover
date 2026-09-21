// Live, opt-in acceptance against the private disposable repository only.
// Retain the evidence file/runtime directory on failure for reconciliation.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateConfig } from "../dist/config.js";
import { checkStorage, openRuntime } from "../dist/storage.js";
import { GitHubClient, ghTransport } from "../dist/github.js";
const [mount, uuid, evidencePath] = process.argv.slice(2);
if (!mount || !uuid || !evidencePath)
  throw Error("Usage: rehearse-intake MOUNT VERIFIED_UUID EVIDENCE_PATH");
if (existsSync(evidencePath))
  throw Error(
    "Evidence already exists; inspect/reconcile it before another rehearsal",
  );
const repository = "talaniz/prime-mover-fixture";
const gh = new GitHubClient();
assert.equal(await gh.identity(), "talaniz");
async function api(method, path, body) {
  const response = await ghTransport(method, path, body);
  assert.ok(
    response.status >= 200 && response.status < 300,
    `GitHub HTTP ${response.status}`,
  );
  return response.body;
}
const repo = await api("GET", `repos/${repository}`);
assert.equal(repo.private, true);
assert.equal(repo.full_name, repository);
const base = JSON.parse(readFileSync("config.example.json"));
base.storage = { mount, uuid, root: join(mount, "codex-work") };
base.metadata.socket = join(
  base.storage.root,
  "data",
  "prime-mover",
  "metadata.sock",
);
checkStorage(validateConfig(base));
const root = mkdtempSync(join(base.storage.root, "intake-rehearsal-"));
base.storage.root = root;
base.metadata.socket = join(root, "metadata.sock");
base.metadata.tokenFile = join(root, "unused-token");
base.projects = [
  {
    ...base.projects[0],
    id: "fixture",
    name: "Acceptance fixture",
    repository,
  },
];
const config = validateConfig(base);
const configPath = join(root, "config.local.json");
writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
const evidence = {
  repository,
  root,
  configPath,
  startedAt: new Date().toISOString(),
  phase: "prepared",
  issues: [],
  productionIntakeEnabled: false,
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
  const r = spawnSync(
    process.execPath,
    ["dist/cli.js", name, configPath, ...args],
    { encoding: "utf8", timeout: 120000 },
  );
  assert.equal(r.status, 0, `${name}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}
function poll() {
  state((s) => s.recordPoll("fixture", null, null, 0));
  command("poll");
}
async function pollUntil(predicate) {
  for (let attempt = 0; attempt < 15; attempt++) {
    poll();
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw Error(
    "GitHub propagation or intake did not reach the expected state within bounded polls",
  );
}
const labels = await api("GET", `repos/${repository}/labels?per_page=100`);
if (!labels.some((l) => l.name === "codex-ready"))
  await api("POST", `repos/${repository}/labels`, {
    name: "codex-ready",
    color: "1D76DB",
    description:
      "Explicit maintainer authorization for disposable acceptance only",
  });
const body =
  "## Objective\nVerify authorized intake without starting execution.\n## Scope\nDisposable fixture issue and acknowledgment only.\n## Acceptance criteria\nOne durable job and acknowledgment; no task starts.\n## Verification\nInspect persisted state, label actor, and GitHub comments.";
const issue = await api("POST", `repos/${repository}/issues`, {
  title: `Build 003 intake acceptance ${evidence.startedAt}`,
  body,
});
evidence.issues.push(issue.number);
evidence.phase = "issue-created";
save();
poll();
assert.equal(
  state((s) => s.jobs().length),
  0,
);
await api("POST", `repos/${repository}/issues/${issue.number}/labels`, {
  labels: ["codex-ready"],
});
await pollUntil(() => state((s) => s.jobs().some((j) => j.stage === "queued")));
let job = state((s) => s.jobs()[0]);
assert.equal(job.stage, "queued");
const events = await gh.events(repository, issue.number);
const event = events.items.filter((e) => e.label === "codex-ready").at(-1);
assert.equal(event.actor, "talaniz");
assert.equal(event.event, "labeled");
evidence.labelEvent = { id: event.id, actor: event.actor };
evidence.jobId = job.id;
let comments = await gh.comments(repository, issue.number);
assert.equal(comments.items.length, 1);
evidence.acknowledgmentId = comments.items[0].id;
poll();
assert.equal(
  state((s) => s.jobs().length),
  1,
);
comments = await gh.comments(repository, issue.number);
assert.equal(comments.items.length, 1);
evidence.restartAndPollDeduplicated = true;
evidence.phase = "acknowledged";
save();
await api("PATCH", `repos/${repository}/issues/${issue.number}`, {
  title: `Build 003 amended intake acceptance ${evidence.startedAt}`,
});
await pollUntil(
  () => state((s) => s.job(job.id).blockCode) === "contract-changed",
);
assert.equal(
  state((s) => s.job(job.id).blockCode),
  "contract-changed",
);
command("reconcile-issue", job.id, "Live fixture accepts revised title");
assert.equal(
  state((s) => s.job(job.id).stage),
  "queued",
);
evidence.editReconciliation = true;
await api(
  "DELETE",
  `repos/${repository}/issues/${issue.number}/labels/codex-ready`,
);
await pollUntil(() => state((s) => s.job(job.id).stage) === "cancelled");
assert.equal(
  state((s) => s.job(job.id).stage),
  "cancelled",
);
evidence.withdrawalCancelled = true;
await api("POST", `repos/${repository}/issues/${issue.number}/labels`, {
  labels: ["codex-ready"],
});
poll();
assert.equal(
  state((s) => s.jobs().length),
  1,
);
evidence.relabelDidNotRerun = true;
const rerun = command(
  "rerun",
  job.id,
  "Live fixture explicitly authorizes generation one",
);
assert.notEqual(rerun.id, job.id);
assert.equal(
  state((s) => s.job(rerun.id).generation),
  1,
);
evidence.rerunJobId = rerun.id;
await api("PATCH", `repos/${repository}/issues/${issue.number}`, {
  state: "closed",
});
await pollUntil(() => state((s) => s.job(rerun.id).stage) === "cancelled");
assert.equal(
  state((s) => s.job(rerun.id).stage),
  "cancelled",
);
await api(
  "DELETE",
  `repos/${repository}/issues/${issue.number}/labels/codex-ready`,
);
const incomplete = await api("POST", `repos/${repository}/issues`, {
  title: `Build 003 incomplete requirements ${evidence.startedAt}`,
  body: "## Objective\nTest incomplete contract",
});
evidence.issues.push(incomplete.number);
save();
await api("POST", `repos/${repository}/issues/${incomplete.number}/labels`, {
  labels: ["codex-ready"],
});
await pollUntil(() =>
  state((s) => s.jobs().some((j) => j.issue === incomplete.number)),
);
job = state((s) => s.jobs().find((j) => j.issue === incomplete.number));
assert.equal(job.stage, "blocked");
assert.equal(job.blockCode, "requirements-missing");
comments = await gh.comments(repository, incomplete.number);
assert.equal(comments.items.length, 1);
assert.match(
  comments.items[0].body,
  /Objective.*Scope.*Acceptance criteria.*Verification/s,
);
evidence.missingRequirementsBlocked = true;
await api("PATCH", `repos/${repository}/issues/${incomplete.number}`, {
  state: "closed",
});
await api(
  "DELETE",
  `repos/${repository}/issues/${incomplete.number}/labels/codex-ready`,
);
await pollUntil(() =>
  state((s) => s.jobs().every((j) => j.stage === "cancelled")),
);
assert.ok(
  state((s) =>
    s
      .jobs()
      .every(
        (j) => j.stage === "cancelled" && !j.activeThreadId && !j.activeTurnId,
      ),
  ),
);
evidence.phase = "complete";
evidence.completedAt = new Date().toISOString();
evidence.noExecutionStarted = true;
save();
console.log(JSON.stringify(evidence));
