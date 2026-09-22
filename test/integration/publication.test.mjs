import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Store } from "../../dist/store.js";
import { Worktrees } from "../../dist/worktree.js";
import { Publication } from "../../dist/publication.js";
const project = {
  ...JSON.parse(readFileSync("config.example.json")).projects[0],
  verify: [["node", "--test"]],
  allowedPaths: ["README.md"],
};
function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pm-publish-"));
  const upstream = join(root, "source");
  mkdirSync(upstream);
  git(upstream, "init", "-b", "main");
  git(upstream, "config", "user.name", "Fixture");
  git(upstream, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(upstream, "README.md"), "Initial");
  git(upstream, "add", ".");
  git(upstream, "commit", "-m", "Initial");
  const remote = join(root, "remote.git");
  git(root, "clone", "--bare", upstream, remote);
  const runtime = join(root, "runtime");
  mkdirSync(runtime);
  const trees = new Worktrees(runtime, () => remote);
  const store = new Store(join(root, "jobs.db"));
  store.seedProjects([project]);
  const id = store.enqueue(project.id, 1, {});
  const lease = store.claim("publisher", 60000);
  const context = {
    lease,
    signal: new AbortController().signal,
    assertActive: () => store.assertWorker(lease),
  };
  const plan = await trees.plan(project, { id, issue: 1, generation: 0 });
  await trees.create(plan);
  git(plan.cwd, "config", "user.name", "Fixture");
  git(plan.cwd, "config", "user.email", "fixture@example.invalid");
  writeFileSync(join(plan.cwd, "README.md"), "Implemented");
  let lost = false;
  let calls = 0;
  const prs = [];
  const api = {
    list: async () => prs,
    create: async (repository, input) => {
      calls++;
      const pr = {
        number: 1,
        url: `https://github.com/${repository}/pull/1`,
        head: git(remote, "rev-parse", `refs/heads/${input.branch}`),
        base: plan.baseSha,
        branch: input.branch,
        baseBranch: input.baseBranch,
        state: "open",
        body: input.body,
      };
      prs.push(pr);
      if (lost) {
        lost = false;
        throw Error("lost create response");
      }
      return pr;
    },
  };
  const pub = (authorize = async () => {}) => new Publication(store, trees, api, () => remote, authorize);
  const evidence = (head) => [
    {
      argv: project.verify[0],
      exitCode: 0,
      headSha: head,
      artifact: "private-log",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  ];
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    store,
    context,
    plan,
    project,
    remote,
    api,
    prs,
    pub,
    evidence,
    get calls() {
      return calls;
    },
    lose() {
      lost = true;
    },
  };
}
test("verified coherent commit pushes one branch and creates one PR across repeats", async (t) => {
  const f = await fixture(t);
  const head = await f.pub().commit(f.context, f.plan, f.project);
  assert.match(head, /^[a-f0-9]{40}$/);
  assert.notEqual(head, f.plan.baseSha);
  assert.equal(await f.pub().commit(f.context, f.plan, f.project), head);
  const pr = await f
    .pub()
    .publish(f.context, f.plan, f.project, f.evidence(head), {
      title: "Fixture",
      body: "Acceptance and evidence",
    });
  assert.equal(pr.number, 1);
  assert.equal(git(f.remote, "rev-parse", `refs/heads/${f.plan.branch}`), head);
  await f.pub().publish(f.context, f.plan, f.project, f.evidence(head), {
    title: "Fixture",
    body: "Acceptance and evidence",
  });
  assert.equal(f.calls, 1);
});
test("missing, failed and stale-head verification never pushes or opens a PR", async (t) => {
  const f = await fixture(t);
  const head = await f.pub().commit(f.context, f.plan, f.project);
  for (const evidence of [
    [],
    [{ ...f.evidence(head)[0], exitCode: 1 }],
    [{ ...f.evidence(head)[0], headSha: f.plan.baseSha }],
  ])
    await assert.rejects(
      f.pub().publish(f.context, f.plan, f.project, evidence, {
        title: "Fixture",
        body: "Evidence",
      }),
      /verification/,
    );
  assert.equal(f.calls, 0);
  assert.equal(
    git(
      f.remote,
      "for-each-ref",
      "--format=%(refname)",
      `refs/heads/${f.plan.branch}`,
    ),
    "",
  );
});
test("lost PR response is reconciled by durable marker, never duplicated", async (t) => {
  const f = await fixture(t);
  const head = await f.pub().commit(f.context, f.plan, f.project);
  f.lose();
  await assert.rejects(
    f.pub().publish(f.context, f.plan, f.project, f.evidence(head), {
      title: "Fixture",
      body: "Evidence",
    }),
  );
  const pr = await f
    .pub()
    .publish(f.context, f.plan, f.project, f.evidence(head), {
      title: "Fixture",
      body: "Evidence",
    });
  assert.equal(pr.number, 1);
  assert.equal(f.calls, 1);
  assert.equal(
    f.store
      .operations(f.context.lease.jobId)
      .find((o) => o.kind === "pull-create").status,
    "done",
  );
});
test("unconfirmed PR absence after send remains blocked and does not repeat POST", async (t) => {
  const f = await fixture(t);
  const head = await f.pub().commit(f.context, f.plan, f.project);
  f.lose();
  await assert.rejects(
    f.pub().publish(f.context, f.plan, f.project, f.evidence(head), {
      title: "Fixture",
      body: "Evidence",
    }),
  );
  f.prs.length = 0;
  await assert.rejects(
    f.pub().publish(f.context, f.plan, f.project, f.evidence(head), {
      title: "Fixture",
      body: "Evidence",
    }),
    /uncertain/,
  );
  assert.equal(f.calls, 1);
});
test("crash after local commit is reconciled by parent/tree/message without another commit", async (t) => {
  const f = await fixture(t);
  const complete = f.store.completeOperation.bind(f.store);
  let fail = true;
  f.store.completeOperation = (lease, key, result) => {
    if (key.startsWith("commit:") && fail) {
      fail = false;
      throw Error("crash after commit");
    }
    return complete(lease, key, result);
  };
  await assert.rejects(f.pub().commit(f.context, f.plan, f.project));
  const accepted = git(f.plan.cwd, "rev-parse", "HEAD");
  assert.notEqual(accepted, f.plan.baseSha);
  assert.equal(await f.pub().commit(f.context, f.plan, f.project), accepted);
  assert.equal(
    git(f.plan.cwd, "rev-list", "--count", `${f.plan.baseSha}..HEAD`),
    "1",
  );
});
test("crash after remote push acceptance reconciles the exact branch head before PR creation", async (t) => {
  const f = await fixture(t);
  const head = await f.pub().commit(f.context, f.plan, f.project);
  const complete = f.store.completeOperation.bind(f.store);
  let fail = true;
  f.store.completeOperation = (lease, key, result) => {
    if (key.startsWith("push:") && fail) {
      fail = false;
      throw Error("crash after push");
    }
    return complete(lease, key, result);
  };
  await assert.rejects(
    f
      .pub()
      .publish(f.context, f.plan, f.project, f.evidence(head), {
        title: "Fixture",
        body: "Evidence",
      }),
  );
  assert.equal(git(f.remote, "rev-parse", `refs/heads/${f.plan.branch}`), head);
  assert.equal(f.calls, 0);
  await f
    .pub()
    .publish(f.context, f.plan, f.project, f.evidence(head), {
      title: "Fixture",
      body: "Evidence",
    });
  assert.equal(f.calls, 1);
  assert.ok(
    f.store
      .operations(f.context.lease.jobId)
      .filter((o) => o.kind === "push")
      .every((o) => o.status === "done"),
  );
});
test("advanced base and dirty post-verification output block publication", async (t) => {
  const f = await fixture(t);
  const head = await f.pub().commit(f.context, f.plan, f.project);
  writeFileSync(join(f.plan.cwd, "README.md"), "Unverified edit");
  await assert.rejects(
    f
      .pub()
      .publish(f.context, f.plan, f.project, f.evidence(head), {
        title: "Fixture",
        body: "Evidence",
      }),
    /uncommitted/,
  );
  git(f.plan.cwd, "restore", "README.md");
  git(f.plan.cwd, "push", f.remote, `${head}:refs/heads/main`);
  await assert.rejects(
    f
      .pub()
      .publish(f.context, f.plan, f.project, f.evidence(head), {
        title: "Fixture",
        body: "Evidence",
      }),
    (error) => error.code === "base-branch-changed",
  );
  assert.equal(f.calls, 0);
});

for (const boundary of ["push", "pull-create"]) {
  test(`fresh authorization revoked before ${boundary} prevents that side effect`, async (t) => {
    const f = await fixture(t);
    const head = await f.pub().commit(f.context, f.plan, f.project);
    let checks = 0;
    const pub = f.pub(async (id) => {
      assert.equal(id, f.context.lease.jobId);
      checks++;
      if (checks === (boundary === "push" ? 1 : 2)) throw Error("authorization withdrawn");
    });
    await assert.rejects(pub.publish(f.context, f.plan, f.project, f.evidence(head), {title:"Fixture",body:"Evidence"}), /authorization withdrawn/);
    assert.equal(f.calls, 0);
    assert.equal(git(f.remote,"for-each-ref","--format=%(objectname)",`refs/heads/${f.plan.branch}`), boundary === "push" ? "" : head);
    assert.equal(f.store.operations(f.context.lease.jobId).some(o => o.kind === boundary && o.status === "pending"), false);
  });
}
