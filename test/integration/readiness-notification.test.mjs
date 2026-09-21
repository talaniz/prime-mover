import test from "node:test";
import assert from "node:assert/strict";
import { fixture, target } from "../support/review-fixture.mjs";
import { PrComments } from "../../dist/pr-comments.js";
function ready(t, mode = "normal") {
  const f = fixture(t);
  f.e2e.record(f.lease, f.evidence());
  f.project.verify.forEach((argv, i) => {
    const key = `verify:${target.head}:${i}`;
    f.store.operation(f.lease, key, "verification", { argv });
    f.store.completeOperation(f.lease, key, {
      result: { status: "passed", exitCode: 0 },
      artifact: "/private/result.json",
    });
  });
  let posts = 0,
    denied = false;
  const comments = [];
  const ctx = {
    lease: f.lease,
    signal: new AbortController().signal,
    assertActive: () => f.store.assertWorker(f.lease),
  };
  const api = {
    identity: async () => "talaniz",
    comments: async () => ({ items: comments, next: null }),
    comment: async (_repo, _pr, body) => {
      posts++;
      if (mode !== "before")
        comments.push({ id: "10", actor: "talaniz", body });
      if (mode !== "normal" && posts === 1) throw Error("lost response");
      return "10";
    },
  };
  const sender = () =>
    new PrComments(f.store, api, async () => {
      if (denied) throw Error("withdrawn");
    });
  const remote = {
    ...target,
    observedAt: Date.now(),
    open: true,
    mergeable: true,
    checks: [],
    requiredChecks: [],
  };
  return {
    ...f,
    ctx,
    remote,
    comments,
    sender,
    deny() {
      denied = true;
    },
    get posts() {
      return posts;
    },
  };
}
test("one readiness comment includes owner, exact head, checks, independent reports and human actions", async (t) => {
  const f = ready(t);
  const url = await f.sender().ready(f.ctx, f.remote);
  assert.match(url, /#issuecomment-10$/);
  await f.sender().ready(f.ctx, { ...f.remote, observedAt: Date.now() });
  assert.equal(f.posts, 1);
  assert.match(f.comments[0].body, /@talaniz/);
  assert.ok(f.comments[0].body.includes(target.head));
  assert.ok(f.comments[0].body.includes(f.evidence().reportUrl));
  assert.match(f.comments[0].body, /merge.*deploy/i);
  assert.match(f.comments[0].body, /verification/i);
  assert.equal(f.store.notifications(f.id)[0].status, "done");
  f.store.finishReady(f.lease, { ...f.remote, observedAt: Date.now() });
  assert.equal(f.store.job(f.id).stage, "ready");
});
test("lost readiness response recovers the accepted remote comment without sending twice", async (t) => {
  const f = ready(t, "lost");
  await assert.rejects(() => f.sender().ready(f.ctx, f.remote), /lost/);
  assert.equal(f.store.notifications(f.id)[0].status, "pending");
  await f.sender().ready(f.ctx, f.remote);
  assert.equal(f.posts, 1);
  assert.equal(f.store.notifications(f.id)[0].status, "done");
});
test("ambiguous readiness absence keeps its outbox pending and never blindly reposts", async (t) => {
  const f = ready(t, "before");
  await assert.rejects(() => f.sender().ready(f.ctx, f.remote), /lost/);
  await assert.rejects(
    () => f.sender().ready(f.ctx, f.remote),
    /uncertain|reconcile/,
  );
  assert.equal(f.posts, 1);
  assert.equal(f.store.notifications(f.id)[0].status, "pending");
  assert.notEqual(f.store.job(f.id).stage, "ready");
});
test("withdrawal prevents readiness notification intent or remote send", async (t) => {
  const f = ready(t);
  f.deny();
  await assert.rejects(() => f.sender().ready(f.ctx, f.remote), /withdrawn/);
  assert.equal(f.posts, 0);
  assert.equal(f.store.notifications(f.id).length, 0);
});
