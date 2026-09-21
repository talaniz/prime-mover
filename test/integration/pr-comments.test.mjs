import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../../dist/store.js";
import { PrComments } from "../../dist/pr-comments.js";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pm-reports-")),
    store = new Store(join(root, "db"));
  const p = JSON.parse(readFileSync("config.example.json")).projects[0];
  store.seedProjects([p]);
  const id = store.enqueue(p.id, 1, {}),
    lease = store.claim("reports", 60000);
  const context = {
    lease,
    signal: new AbortController().signal,
    assertActive: () => store.assertWorker(lease),
  };
  let posts = 0,
    lost = false,
    denied = false;
  const comments = [];
  const github = {
    identity: async () => "talaniz",
    comments: async (_repo, _pr, cursor) => ({
      items: cursor ? comments : [],
      next: cursor ? null : "2",
    }),
    comment: async (_repo, pr, body) => {
      assert.equal(pr, 3);
      posts++;
      comments.push({ id: String(posts), body, actor: "talaniz" });
      if (lost) {
        lost = false;
        throw Error("lost response");
      }
      return String(posts);
    },
  };
  const sender = () =>
    new PrComments(store, github, async () => {
      if (denied) throw Error("withdrawn");
    });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    store,
    id,
    context,
    comments,
    github,
    sender,
    get posts() {
      return posts;
    },
    lose() {
      lost = true;
    },
    deny() {
      denied = true;
    },
  };
}
test("attributed PR report is persisted and published once with canonical evidence URL", async (t) => {
  const f = fixture(t),
    body =
      "Code reviewer task abc, reviewed head " +
      "a".repeat(40) +
      "\nSIGN-OFF; checks passed";
  const url = await f.sender().publish(f.context, "code-review-1", 3, body);
  assert.equal(
    url,
    "https://github.com/talaniz/prime-mover/pull/3#issuecomment-1",
  );
  assert.equal(
    await f.sender().publish(f.context, "code-review-1", 3, body),
    url,
  );
  assert.equal(f.posts, 1);
  assert.ok(f.comments[0].body.startsWith(body));
  assert.match(f.comments[0].body, /prime-mover-comment:/);
  await assert.rejects(
    f.sender().publish(f.context, "code-review-1", 3, "changed report"),
    /mismatch|changed/i,
  );
});
test("lost report response reconciles complete paginated body and author without another POST", async (t) => {
  const f = fixture(t);
  f.lose();
  await assert.rejects(
    f.sender().publish(f.context, "code-review-1", 3, "Findings"),
  );
  assert.equal(
    await f.sender().publish(f.context, "code-review-1", 3, "Findings"),
    "https://github.com/talaniz/prime-mover/pull/3#issuecomment-1",
  );
  assert.equal(f.posts, 1);
});
test("ambiguous report absence or a matching body from another author stays blocked", async (t) => {
  const f = fixture(t);
  f.lose();
  await assert.rejects(
    f.sender().publish(f.context, "code-review-1", 3, "Findings"),
  );
  f.comments[0].actor = "untrusted";
  await assert.rejects(
    f.sender().publish(f.context, "code-review-1", 3, "Findings"),
    /uncertain|reconcil/i,
  );
  f.comments.length = 0;
  await assert.rejects(
    f.sender().publish(f.context, "code-review-1", 3, "Findings"),
    /uncertain|reconcil/i,
  );
  assert.equal(f.posts, 1);
});
test("withdrawn authorization prevents a new report POST without leaving an ambiguous send intent", async (t) => {
  const f = fixture(t);
  f.deny();
  await assert.rejects(
    f.sender().publish(f.context, "code-review-1", 3, "Findings"),
    /withdrawn/,
  );
  assert.equal(f.posts, 0);
  assert.equal(f.store.operations(f.id).length, 0);
});
