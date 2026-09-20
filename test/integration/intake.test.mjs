import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";
import { Intake } from "../../dist/intake.js";
import { GitHubFailure } from "../../dist/github.js";
const projects = JSON.parse(readFileSync("config.example.json")).projects;
const body =
  "## Objective\nCreate greeting\n## Scope\ngreeting.txt\n## Acceptance criteria\nContains hello\n## Verification\nRead greeting.txt";
function setup(t) {
  let now = 100000;
  const root = mkdtempSync(join(tmpdir(), "pm-intake-"));
  let store = new Store(join(root, "state.db"), () => now);
  store.seedProjects(projects);
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const issues = new Map(
    projects.map((p) => [
      p.repository,
      {
        repository: p.repository,
        number: 1,
        title: "Greeting",
        body,
        state: "open",
        labels: ["codex-ready"],
        updatedAt: "2026-09-20T00:00:00Z",
        isPullRequest: false,
      },
    ]),
  );
  const comments = new Map();
  const actors = new Map();
  const failures = new Map();
  const calls = [];
  let lost = false;
  let interrupt = [];
  const gh = {
    identity: async () => "talaniz",
    issues: async (repo, cursor) => {
      calls.push([repo, cursor]);
      if (failures.has(repo)) throw failures.get(repo);
      return {
        items: issues.has(repo) ? [issues.get(repo), issues.get(repo)] : [],
        next: null,
      };
    },
    issue: async (repo) => {
      if (failures.has(repo)) throw failures.get(repo);
      return structuredClone(issues.get(repo));
    },
    events: async (repo) => ({
      items: [
        {
          id: "10",
          actor: actors.get(repo) ?? "talaniz",
          label: "codex-ready",
          event: "labeled",
          createdAt: "2026-09-20T00:00:00Z",
        },
      ],
      next: null,
    }),
    comments: async (repo) => ({ items: comments.get(repo) ?? [], next: null }),
    comment: async (repo, num, text) => {
      const list = comments.get(repo) ?? [];
      const id = String(list.length + 1);
      list.push({ id, actor: "talaniz", body: text });
      comments.set(repo, list);
      if (lost) {
        lost = false;
        throw new GitHubFailure("unavailable");
      }
      return id;
    },
  };
  const options = {
    now: () => now,
    pollMs: 1000,
    interrupt: async (thread, turn) => {
      interrupt.push([thread, turn]);
    },
  };
  return {
    get store() {
      return store;
    },
    gh,
    issues,
    comments,
    actors,
    failures,
    calls,
    interrupt,
    advance() {
      now += 2000;
    },
    lose() {
      lost = true;
    },
    intake: () => new Intake(store, gh, options),
    restart() {
      store.close();
      store = new Store(join(root, "state.db"), () => now);
    },
  };
}
test("duplicate pages/polls and restart yield one authorized job and acknowledgment per repo", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  assert.equal(f.store.jobs().length, 2);
  assert.ok(f.store.jobs().every((j) => j.stage === "queued"));
  assert.equal(f.comments.size, 2);
  f.restart();
  f.advance();
  await f.intake().poll();
  assert.equal(f.store.jobs().length, 2);
  assert.ok([...f.comments.values()].every((c) => c.length === 1));
});
test("unauthorized issues never queue; missing requirements persist blocked and clarified", async (t) => {
  const f = setup(t);
  f.actors.set(projects[0].repository, "outsider");
  f.issues.get(projects[1].repository).body = "## Objective\nSomething";
  await f.intake().poll();
  assert.equal(f.store.jobs().length, 1);
  const job = f.store.jobs()[0];
  assert.equal(job.stage, "blocked");
  assert.equal(job.blockCode, "requirements-missing");
  assert.match(
    f.comments.get(projects[1].repository)[0].body,
    /Objective.*Scope.*Acceptance criteria.*Verification/s,
  );
});
test("material edits freeze execution until explicit contract reconciliation", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const job = f.store.jobs().find((j) => j.projectId === projects[0].id);
  f.issues.get(job.repository).title = "Material change";
  f.advance();
  await f.intake().poll();
  assert.equal(f.store.job(job.id).blockCode, "contract-changed");
  assert.throws(() => f.store.retryBlocked(job.id, "retry"), /reconcil/i);
  await f.intake().reconcile(job.id, "Accept revised title");
  assert.equal(f.store.job(job.id).stage, "queued");
  assert.equal(f.store.job(job.id).snapshot.issue.title, "Material change");
});
test("removed label fences active worker and requests exact owned turn interruption", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const lease = f.store.claim("worker", 10000);
  f.store.beginTurn(lease, "task-owned", "turn-owned");
  const job = f.store.job(lease.jobId);
  f.issues.get(job.repository).labels = [];
  f.advance();
  await f.intake().poll();
  assert.equal(f.store.job(job.id).cancelRequested, true);
  assert.throws(() => f.store.assertWorker(lease), /cancel/i);
  assert.deepEqual(f.interrupt, [["task-owned", "turn-owned"]]);
  assert.equal(f.store.job(job.id).activeTurnId, "turn-owned");
});
test("closed issues cancel and label toggles do not implicitly create reruns", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const job = f.store.jobs()[0];
  f.issues.get(job.repository).state = "closed";
  f.advance();
  await f.intake().poll();
  assert.equal(f.store.job(job.id).stage, "cancelled");
  f.issues.get(job.repository).state = "open";
  f.advance();
  await f.intake().poll();
  assert.equal(
    f.store.jobs().filter((j) => j.repository === job.repository).length,
    1,
  );
  const next = await f.intake().rerun(job.id, "Explicit fresh attempt");
  assert.equal(f.store.job(next).generation, 1);
  assert.equal(f.store.job(next).stage, "queued");
  assert.ok(f.store.events(next).some((e) => e.kind === "operator-rerun"));
});
for (const kind of [
  "authentication",
  "forbidden",
  "rate-limited",
  "unavailable",
])
  test(`durable ${kind} backoff leaves other repository progressing`, async (t) => {
    const f = setup(t);
    f.failures.set(projects[0].repository, new GitHubFailure(kind, 150000));
    await f.intake().poll();
    assert.equal(f.store.jobs().length, 1);
    assert.equal(f.store.jobs()[0].projectId, projects[1].id);
    assert.equal(
      f.store.projects().find((p) => p.id === projects[0].id).blockCode,
      `github-${kind}`,
    );
    const count = f.calls.filter((c) => c[0] === projects[0].repository).length;
    f.restart();
    await f.intake().poll();
    assert.equal(
      f.calls.filter((c) => c[0] === projects[0].repository).length,
      count,
    );
  });
test("lost acknowledgment response reconciles by marker and author without duplicate", async (t) => {
  const f = setup(t);
  f.lose();
  await f.intake().poll();
  f.restart();
  f.advance();
  await f.intake().poll();
  assert.ok([...f.comments.values()].every((c) => c.length === 1));
  assert.ok(f.store.jobs().every((j) => j.stage === "queued"));
});
test("page checkpoint advances only after durable items and survives interruption", async (t) => {
  const f = setup(t);
  let fail = true;
  f.gh.issues = async (repo, cursor) => {
    f.calls.push([repo, cursor]);
    if (cursor === "2" && fail) throw new GitHubFailure("unavailable");
    return {
      items: cursor
        ? [{ ...f.issues.get(repo), number: 2 }]
        : [f.issues.get(repo)],
      next: cursor ? null : "2",
    };
  };
  f.gh.issue = async (repo, number) => ({ ...f.issues.get(repo), number });
  await f.intake().poll();
  assert.equal(f.store.jobs().length, 2);
  f.restart();
  fail = false;
  for (let n = 0; n < 40; n++) f.advance();
  await f.intake().poll();
  assert.equal(f.store.jobs().length, 4);
  assert.ok(f.calls.some((c) => c[1] === "2"));
});
test("paused intake still cancels existing work on withdrawal", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const job = f.store.jobs()[0];
  f.store.setPaused(true);
  f.issues.get(job.repository).labels = [];
  f.advance();
  await f.intake().poll();
  assert.equal(f.store.job(job.id).stage, "cancelled");
});
test("material edit fences new operations even after scheduler changes the blocker", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const lease = f.store.claim("worker", 10000);
  const job = f.store.job(lease.jobId);
  f.issues.get(job.repository).body += "\nChanged verification";
  f.advance();
  await f.intake().poll();
  assert.throws(
    () => f.store.operation(lease, "publish", "push", {}),
    /reconcil/i,
  );
  assert.throws(() => f.store.transition(lease, "waiting"), /reconcil/i);
  f.store.blockAndRelease(lease, "external-state-unknown");
  assert.throws(() => f.store.retryBlocked(job.id, "Try again"), /reconcil/i);
});
test("disabled project stops an active job even during poll backoff", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const lease = f.store.claim("worker", 10000);
  f.store.beginTurn(lease, "owned", "active");
  const job = f.store.job(lease.jobId);
  f.store.setProjectEnabled(job.projectId, false);
  await f.intake().poll();
  assert.equal(f.store.job(job.id).cancelRequested, true);
  assert.deepEqual(f.interrupt, [["owned", "active"]]);
});
test("authoritative check immediately before work catches withdrawal without waiting for poll", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const job = f.store.jobs()[0];
  f.issues.get(job.repository).labels = [];
  await assert.rejects(
    f.intake().authorize(job.id),
    /authorization|reconciliation/,
  );
  assert.equal(f.store.job(job.id).stage, "cancelled");
});
test("uncertain undelivered acknowledgment is never blindly reposted, including forged marker", async (t) => {
  const f = setup(t);
  let posts = 0;
  f.gh.comment = async () => {
    posts++;
    throw new GitHubFailure("unavailable");
  };
  await f.intake().poll();
  for (const job of f.store.jobs()) {
    const ack = f.store.intakeAck(job.id);
    f.comments.set(job.repository, [
      { id: "99", actor: "outsider", body: ack.body },
    ]);
  }
  f.restart();
  f.advance();
  await f.intake().poll();
  assert.equal(posts, 2);
  assert.ok(f.store.jobs().every((j) => j.stage === "blocked"));
  assert.equal(f.store.claim("worker", 1000), null);
});
test("intake pause prevents explicit reruns from queueing new work", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const job = f.store.jobs()[0];
  f.store.cancel(job.id, "operator stopped");
  f.store.setPaused(true);
  await assert.rejects(f.intake().rerun(job.id, "Try again"), /paused/);
});
test("slow repository does not delay another repository intake", async (t) => {
  const f = setup(t);
  const slow = [...projects].sort((a, b) => a.id.localeCompare(b.id))[0]
    .repository;
  const fast = projects.find((p) => p.repository !== slow).repository;
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const original = f.gh.issues;
  f.gh.issues = async (repo, cursor) => {
    if (repo === slow) await gate;
    return original(repo, cursor);
  };
  const polling = f.intake().poll();
  try {
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(f.store.jobs().some((j) => j.repository === fast));
  } finally {
    release();
    await polling;
  }
});
test("eventual label discovery is found on a later complete scan", async (t) => {
  const f = setup(t);
  const original = f.gh.issues;
  let stale = true;
  f.gh.issues = async (...args) =>
    stale ? { items: [], next: null } : original(...args);
  await f.intake().poll();
  assert.equal(f.store.jobs().length, 0);
  stale = false;
  f.advance();
  await f.intake().poll();
  assert.equal(f.store.jobs().length, 2);
});
test("contract reconciliation cannot requeue an unchanged job", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const job = f.store.jobs()[0];
  await assert.rejects(
    f.intake().reconcile(job.id, "Unnecessary reconciliation"),
    /changed|incomplete|reconcil/i,
  );
});
test("fresh authorization can be rechecked during an approval wait without treating the wait as withdrawal", async (t) => {
  const f = setup(t);
  await f.intake().poll();
  const lease = f.store.claim("worker", 10000);
  f.store.beginTurn(lease, "waiting-task", "waiting-turn");
  f.store.transition(lease, "waiting", "approval-required");
  const snapshot = await f.intake().authorize(lease.jobId);
  assert.equal(snapshot.decision.runnable, true);
  assert.equal(f.store.job(lease.jobId).cancelRequested, false);
});
