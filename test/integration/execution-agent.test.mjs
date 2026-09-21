import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";
import { ExecutionAgent } from "../../dist/execution-agent.js";
const projects = JSON.parse(readFileSync("config.example.json")).projects;
function fixture(t) {
  let now = 1000;
  const root = mkdtempSync(join(tmpdir(), "pm-agent-"));
  let store = new Store(join(root, "db"), () => now);
  store.seedProjects(projects);
  const id = store.enqueue(projects[0].id, 1, {});
  const lease = store.claim("worker", 100000);
  const abort = new AbortController();
  const context = {
    lease,
    signal: abort.signal,
    assertActive: () => store.assertWorker(lease),
  };
  const rpc = new EventEmitter();
  let thread;
  let turn;
  let lostThread = false,
    lostTurn = false,
    approval = false;
  const calls = [];
  rpc.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "thread/start") {
      thread = {
        id: "owned-task",
        cwd: params.cwd,
        threadSource: params.threadSource,
        status: { type: "idle" },
        createdAt: 1,
      };
      if (lostThread) {
        lostThread = false;
        throw Error("lost response");
      }
      return {
        thread,
        cwd: params.cwd,
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandbox: { type: "workspaceWrite" },
      };
    }
    if (method === "thread/list")
      return {
        data: [
          {
            id: "unrelated",
            cwd: "/somewhere/else",
            threadSource: "unrelated",
          },
          ...(thread ? [thread] : []),
        ],
        nextCursor: null,
      };
    if (method === "thread/read")
      return {
        thread: {
          ...thread,
          status:
            turn?.status === "inProgress"
              ? {
                  type: "active",
                  activeFlags: approval ? ["waitingOnApproval"] : [],
                }
              : { type: "idle" },
        },
      };
    if (method === "thread/resume")
      return {
        thread: {
          ...thread,
          status:
            turn?.status === "inProgress"
              ? { type: "active", activeFlags: [] }
              : { type: "idle" },
        },
        cwd: thread.cwd,
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandbox: { type: "workspaceWrite" },
      };
    if (method === "turn/start") {
      turn = {
        id: "owned-turn",
        status: "inProgress",
        items: [
          {
            type: "userMessage",
            clientId: params.clientUserMessageId,
            content: params.input,
          },
        ],
      };
      if (lostTurn) {
        lostTurn = false;
        throw Error("lost response");
      }
      return { turn };
    }
    if (method === "thread/turns/list")
      return { data: turn ? [turn] : [], nextCursor: null };
    if (method === "turn/interrupt") {
      assert.equal(params.threadId, "owned-task");
      assert.equal(params.turnId, "owned-turn");
      turn.status = "interrupted";
      return {};
    }
    throw Error(`Unexpected RPC ${method}`);
  };
  const agents = [];
  const agent = () => {
    const a = new ExecutionAgent(store, rpc, () => now);
    agents.push(a);
    return a;
  };
  t.after(() => {
    for (const a of agents) a.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    get store() {
      return store;
    },
    id,
    context,
    rpc,
    calls,
    agent,
    input: {
      key: "implementation-0",
      cwd: join(root, "worktree"),
      prompt: "Implement the trusted fixture contract.",
      timeoutMs: 5000,
    },
    loseThread() {
      lostThread = true;
    },
    loseTurn() {
      lostTurn = true;
    },
    approveWait() {
      approval = true;
    },
    finish(status = "completed") {
      turn.status = status;
    },
    advance(ms) {
      now += ms;
    },
    abort() {
      abort.abort();
    },
    restart() {
      store.close();
      store = new Store(join(root, "db"), () => now);
    },
  };
}
test("persists task/turn identities and retains active reservation until observed completion", async (t) => {
  const f = fixture(t);
  const a = f.agent();
  const run = await a.start(f.context, f.input);
  assert.equal(run.threadId, "owned-task");
  assert.equal(run.turnId, "owned-turn");
  assert.equal(f.store.job(f.id).activeTurnId, "owned-turn");
  assert.equal(await a.observe(f.context, run), "active");
  f.finish();
  assert.equal(await a.observe(f.context, run), "completed");
  assert.equal(f.store.job(f.id).activeTurnId, null);
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 1);
});
test("lost task-start response reconciles persisted provenance without touching unrelated tasks", async (t) => {
  const f = fixture(t);
  f.loseThread();
  await assert.rejects(f.agent().start(f.context, f.input));
  f.restart();
  const run = await f.agent().start(f.context, f.input);
  assert.equal(run.threadId, "owned-task");
  assert.equal(f.calls.filter((c) => c.method === "thread/start").length, 1);
  assert.ok(f.store.operations(f.id).every((o) => o.status === "done"));
});
test("lost turn-start response is matched through persisted client ID, never started twice", async (t) => {
  const f = fixture(t);
  f.loseTurn();
  await assert.rejects(f.agent().start(f.context, f.input));
  f.restart();
  const run = await f.agent().start(f.context, f.input);
  assert.equal(run.turnId, "owned-turn");
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 1);
  assert.equal(f.store.job(f.id).activeTurnId, "owned-turn");
});
test("pending approval stays waiting and does not clear or approve the owned turn", async (t) => {
  const f = fixture(t);
  const a = f.agent();
  const run = await a.start(f.context, f.input);
  f.approveWait();
  assert.equal(await a.observe(f.context, run), "waiting");
  assert.equal(f.store.job(f.id).activeTurnId, "owned-turn");
  assert.ok(
    !f.calls.some((c) => /approval.*respond|response|approve/.test(c.method)),
  );
});
test("deadline and cancellation interrupt only the recorded owned turn and retain until history confirms", async (t) => {
  const f = fixture(t);
  const a = f.agent();
  const run = await a.start(f.context, f.input);
  f.advance(6000);
  assert.equal(await a.observe(f.context, run), "timed-out");
  assert.equal(f.store.job(f.id).activeTurnId, "owned-turn");
  assert.equal(await a.observe(f.context, run), "interrupted");
  assert.equal(f.store.job(f.id).activeTurnId, null);
  assert.equal(f.calls.filter((c) => c.method === "turn/interrupt").length, 1);
});
test("failed implementation is not success, and unknown history never starts a replacement", async (t) => {
  const f = fixture(t);
  f.loseTurn();
  await assert.rejects(f.agent().start(f.context, f.input));
  const original = f.rpc.request;
  f.rpc.request = async (m, p) =>
    m === "thread/turns/list" ? { data: [], nextCursor: null } : original(m, p);
  await assert.rejects(
    f.agent().start(f.context, f.input),
    /uncertain|reconcil/,
  );
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 1);
});
test("cancellation during turn-start response still reserves the accepted remote turn", async (t) => {
  const f = fixture(t);
  const original = f.rpc.request;
  f.rpc.request = async (m, p) => {
    const result = await original(m, p);
    if (m === "turn/start") f.store.cancel(f.id, "cancel raced response");
    return result;
  };
  const run = await f.agent().start(f.context, f.input);
  assert.equal(run.turnId, "owned-turn");
  assert.equal(f.store.job(f.id).activeTurnId, "owned-turn");
  assert.throws(
    () => f.store.completeCancellation(f.context.lease),
    /active|reconcil/,
  );
});
test("request resolution clears only its matching approval wait; unrelated task requests are ignored", async (t) => {
  const f = fixture(t);
  const a = f.agent();
  const run = await a.start(f.context, f.input);
  f.rpc.emit("notification", {
    id: 10,
    method: "item/commandExecution/requestApproval",
    params: { threadId: "unrelated" },
  });
  assert.equal(await a.observe(f.context, run), "active");
  for (const id of [11, 12])
    f.rpc.emit("notification", {
      id,
      method: "item/commandExecution/requestApproval",
      params: { threadId: run.threadId },
    });
  assert.equal(await a.observe(f.context, run), "waiting");
  f.rpc.emit("notification", {
    method: "serverRequest/resolved",
    params: { threadId: run.threadId, requestId: 11 },
  });
  assert.equal(await a.observe(f.context, run), "waiting");
  f.rpc.emit("notification", {
    method: "serverRequest/resolved",
    params: { threadId: run.threadId, requestId: 12 },
  });
  assert.equal(await a.observe(f.context, run), "active");
});
test("failed terminal turn clears reservation but never returns completed", async (t) => {
  const f = fixture(t);
  const a = f.agent();
  const run = await a.start(f.context, f.input);
  f.finish("failed");
  assert.equal(await a.observe(f.context, run), "failed");
  assert.equal(f.store.job(f.id).activeTurnId, null);
});
test("lost response recovery paginates history and leaves unmatched requests blocked", async (t) => {
  const f = fixture(t);
  f.loseTurn();
  await assert.rejects(f.agent().start(f.context, f.input));
  const original = f.rpc.request;
  f.rpc.request = async (m, p) =>
    m === "thread/turns/list" && !p.cursor
      ? {
          data: [
            { id: "older-unrelated-turn", items: [], status: "completed" },
          ],
          nextCursor: "next-page",
        }
      : original(m, p);
  const run = await f.agent().start(f.context, f.input);
  assert.equal(run.turnId, "owned-turn");
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 1);
});
test("observing an old completed run cannot ignore a different reserved turn", async (t) => {
  const f = fixture(t);
  const a = f.agent();
  const run = await a.start(f.context, f.input);
  f.finish();
  assert.equal(await a.observe(f.context, run), "completed");
  f.store.beginTurn(
    f.context.lease,
    "another-owned-task",
    "another-owned-turn",
  );
  await assert.rejects(a.observe(f.context, run), /identity|reserved/);
  assert.equal(f.store.job(f.id).activeTurnId, "another-owned-turn");
});
test("a freshly started task is used directly before its first persisted turn, not resumed", async (t) => {
  const f = fixture(t);
  const original = f.rpc.request;
  f.rpc.request = async (m, p) => {
    if (m === "thread/resume")
      throw Error("Fresh empty tasks have no rollout to resume");
    return original(m, p);
  };
  const run = await f.agent().start(f.context, f.input);
  assert.equal(run.turnId, "owned-turn");
  assert.equal(f.calls.filter((c) => c.method === "thread/start").length, 1);
});
test("explicit publication recovery reclaims only a completed implementation with no active reservation", async (t) => {
  const f = fixture(t);
  const a = f.agent();
  const run = await a.start(f.context, f.input);
  f.finish();
  await a.observe(f.context, run);
  f.store.operation(f.context.lease, "commit:implementation", "commit", {
    parent: "base",
    tree: "tree",
  });
  f.store.blockAndRelease(f.context.lease, "implementation-error");
  const lease = f.store.reclaimPublication(
    f.id,
    "recovery-worker",
    10000,
    "Git author configured after proven turn completion",
  );
  assert.equal(lease.jobId, f.id);
  assert.equal(f.store.job(f.id).leaseOwner, "recovery-worker");
  assert.equal(f.store.job(f.id).stage, "preparing");
  assert.equal(
    f.store.operations(f.id).find((o) => o.kind === "commit").status,
    "pending",
  );
});
test("publication continuation proof rejects active, failed and mismatched tasks without starting work", async (t) => {
  const f = fixture(t);
  const a = f.agent();
  const run = await a.start(f.context, f.input);
  await assert.rejects(a.proveCompleted(f.id), /not-completed/);
  f.finish("failed");
  await a.observe(f.context, run);
  await assert.rejects(a.proveCompleted(f.id), /not-completed/);
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 1);
  assert.throws(
    () => f.store.reclaimPublication(f.id, "new", 10000, "try while owned"),
    /reconciliation/,
  );
});

test("review tasks get independent-review instructions and persist structured-output contract", async (t) => {
  const f = fixture(t),
    agent = f.agent(),
    schema = {
      type: "object",
      properties: { verdict: { type: "string" } },
      required: ["verdict"],
      additionalProperties: false,
    };
  const input = {
    ...f.input,
    key: "code-review-1",
    role: "code-review",
    outputSchema: schema,
  };
  await agent.start(f.context, input);
  assert.match(
    f.calls.find((c) => c.method === "thread/start").params
      .developerInstructions,
    /independent.*review/i,
  );
  assert.deepEqual(
    f.calls.find((c) => c.method === "turn/start").params.outputSchema,
    schema,
  );
  assert.equal(
    f.store.operations(f.id).find((o) => o.key === "code-review-1:thread").input
      .role,
    "code-review",
  );
  await assert.rejects(
    agent.start(f.context, { ...input, role: "implementation" }),
    /role|contract/i,
  );
});
test("review result requires terminal ownership proof and returns final output without commentary", async (t) => {
  const f = fixture(t),
    agent = f.agent(),
    run = await agent.start(f.context, f.input);
  await assert.rejects(agent.result(f.context, run), /complete|result/i);
  f.finish();
  const original = f.rpc.request;
  f.rpc.request = async (method, params) => {
    const reply = await original(method, params);
    if (method === "thread/turns/list")
      reply.data[0].items = [
        { type: "agentMessage", phase: "commentary", text: "still working" },
        {
          type: "agentMessage",
          phase: "final_answer",
          text: '{"verdict":"sign-off"}',
        },
      ];
    return reply;
  };
  assert.equal(await agent.result(f.context, run), '{"verdict":"sign-off"}');
});
test("completed task without an actual final report cannot supply review evidence", async (t) => {
  const f = fixture(t),
    agent = f.agent(),
    run = await agent.start(f.context, f.input);
  f.finish();
  await assert.rejects(agent.result(f.context, run), /result|report/i);
});

test("review follow-up reuses the original independent task with a fresh correlated turn", async (t) => {
  const f = fixture(t),
    a = f.agent(),
    input = { ...f.input, key: "code-review-1", role: "code-review" };
  const first = await a.start(f.context, input);
  f.finish();
  await a.observe(f.context, first);
  a.reuseTask(f.context, "code-review-1", "code-review-2", "code-review");
  const next = await a.start(f.context, {
    ...input,
    key: "code-review-2",
    prompt: "Re-review the fixes and all commits.",
  });
  assert.equal(next.threadId, first.threadId);
  assert.equal(f.calls.filter((c) => c.method === "thread/start").length, 1);
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 2);
  assert.throws(
    () =>
      a.reuseTask(
        f.context,
        "code-review-1",
        "implementation-fix-1",
        "implementation",
      ),
    /role|active/i,
  );
});
test("a different turn cannot be started while an owned turn is still reserved", async (t) => {
  const f = fixture(t),
    a = f.agent();
  await a.start(f.context, f.input);
  await assert.rejects(
    a.start(f.context, {
      ...f.input,
      key: "code-review-1",
      role: "code-review",
    }),
    /active|reserved/i,
  );
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 1);
});

test("verified remote completion permits publication continuation after a stale owned lease", async (t) => {
  const f = fixture(t),
    a = f.agent(),
    run = await a.start(f.context, f.input);
  f.store.transition(f.context.lease, "blocked", "implementation-error");
  f.finish();
  f.advance(100001);
  const proof = await a.proveCompleted(f.id);
  assert.throws(
    () =>
      f.store.reclaimPublication(
        f.id,
        "recovered",
        10000,
        "completed remote task",
      ),
    /reconcil/i,
  );
  const lease = f.store.reclaimPublication(
    f.id,
    "recovered",
    10000,
    "verified completed owned task after stale coordinator lease",
    proof,
  );
  assert.equal(lease.epoch, f.context.lease.epoch + 1);
  assert.equal(f.store.job(f.id).activeTurnId, null);
  assert.equal(f.store.job(f.id).activeThreadId, run.threadId);
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 1);
});
test("transient observation read failure retries only the read, never task or turn creation", async (t) => {
  const f = fixture(t),
    a = f.agent(),
    run = await a.start(f.context, f.input),
    request = f.rpc.request;
  let reads = 0;
  f.rpc.request = async (method, params) => {
    if (method === "thread/read" && ++reads === 1)
      throw Error("transient unavailable read");
    return request(method, params);
  };
  assert.equal(await a.observe(f.context, run), "active");
  assert.equal(reads, 2);
  assert.equal(f.calls.filter((c) => c.method === "thread/start").length, 1);
  assert.equal(f.calls.filter((c) => c.method === "turn/start").length, 1);
});
