import test from "node:test";
import assert from "node:assert/strict";
import { GitHubPulls } from "../../dist/publication.js";
const repository = "talaniz/prime-mover",
  target = {
    head: "b".repeat(40),
    base: "a".repeat(40),
    commits: ["b".repeat(40)],
  };
function fixture(mode = "success") {
  const calls = [];
  let pulls = 0;
  const api = new GitHubPulls(async (method, path) => {
    calls.push(path);
    assert.equal(method, "GET");
    const base = {
        sha: target.base,
        ref: "main",
        repo: { full_name: repository },
      },
      head = { sha: target.head, repo: { full_name: repository } };
    let body;
    if (path.endsWith("/pulls/3")) {
      pulls++;
      body = {
        number: 3,
        state: "open",
        mergeable: true,
        head: {
          ...head,
          ...(mode === "drift" && pulls > 1 ? { sha: "c".repeat(40) } : {}),
        },
        base,
      };
    } else if (path.includes("/check-runs?"))
      body = {
        total_count: 1,
        check_runs: [
          {
            name: "ci",
            head_sha: target.head,
            status: "completed",
            conclusion: mode === "failed" ? "failure" : "success",
            html_url: "https://github.com/talaniz/prime-mover/actions/runs/1",
          },
        ],
      };
    else if (path.includes("/status?"))
      body = { sha: target.head, total_count: 0, statuses: [] };
    else if (path.endsWith("/branches/main") && !path.includes("/rules/"))
      body = { commit: { sha: target.base }, protected: mode === "protected" };
    else if (path.endsWith("/protection/required_status_checks"))
      body = { contexts: ["legacy-ci"], checks: [] };
    else if (path.includes("/rules/branches/"))
      body = [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: [
              { context: "rules-ci", integration_id: 123 },
            ],
          },
        },
      ];
    else throw Error(`unexpected ${path}`);
    return {
      status: mode === "unavailable" && path.includes("check-runs") ? 403 : 200,
      headers: {},
      body,
    };
  });
  return { api, calls };
}
test("readiness reads exact PR/branch and current-head GitHub checks and rechecks drift", async () => {
  const f = fixture(),
    r = await f.api.readiness(repository, 3, "main", target);
  assert.equal(r.head, target.head);
  assert.equal(r.mergeable, true);
  assert.equal(r.checks[0].status, "success");
  assert.deepEqual(r.requiredChecks, []);
  assert.equal(f.calls.filter((p) => p.endsWith("/pulls/3")).length, 2);
});
for (const mode of ["drift", "unavailable"])
  test(`readiness remote adapter fails closed for ${mode}`, async () => {
    const f = fixture(mode);
    await assert.rejects(
      () => f.api.readiness(repository, 3, "main", target),
      /readiness|changed|unavailable/i,
    );
  });
test("failed checks remain failures and protected-branch requirements include legacy and ruleset contexts", async () => {
  assert.equal(
    (await fixture("failed").api.readiness(repository, 3, "main", target))
      .checks[0].status,
    "failure",
  );
  const r = await fixture("protected").api.readiness(
    repository,
    3,
    "main",
    target,
  );
  assert.deepEqual(r.requiredChecks, ["legacy-ci", "rules-ci"]);
});
