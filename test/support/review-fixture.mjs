import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../dist/store.js";
import { Reviews } from "../../dist/reviews.js";
export const target = {
  head: "b".repeat(40),
  base: "a".repeat(40),
  commits: ["b".repeat(40)],
};
export const acceptance =
  "Trim names, preserve internal spaces, reject invalid input";
export function fixture(t, budgetMs = 60000) {
  const root = mkdtempSync(join(tmpdir(), "pm-e2e-evidence-")),
    store = new Store(join(root, "db"));
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const project = JSON.parse(readFileSync("config.example.json")).projects[0];
  store.seedProjects([project]);
  const id = store.enqueue(project.id, 1, {
    decision: { contract: { acceptance } },
  });
  let lease = store.claim("worker", 60000);
  store.operation(lease, "implementation-budget", "execution-budget", {
    deadline: Date.now() + budgetMs,
  });
  store.completeOperation(lease, "implementation-budget", {});
  function task(role, n = 1, thread = role) {
    const key = `${role}-${n}`;
    store.operation(lease, `${key}:thread`, "thread-start", { role });
    store.completeOperation(lease, `${key}:thread`, { threadId: thread });
    store.operation(lease, `${key}:turn`, "turn-start", { threadId: thread });
    store.completeOperation(lease, `${key}:turn`, { turnId: key });
    return { taskId: thread, turnId: key };
  }
  task("implementation", 0);
  store.transition(lease, "implementing");
  store.transition(lease, "verifying");
  store.finishImplementation(lease, 3);
  lease = store.claimCodeReview(id, "worker", 60000);
  const reviews = new Reviews(store);
  reviews.bind(lease, target);
  const report = (role, overrides = {}) => ({
    ...target,
    taskId: role,
    turnId: `${role}-1`,
    reportUrl: `https://github.com/${project.repository}/pull/3#issuecomment-${role === "code-review" ? 1 : 2}`,
    verdict: "sign-off",
    checks: ["Executed isolated acceptance commands and verified results"],
    limitations: [],
    findings: [],
    resolutions: [],
    ...overrides,
  });
  task("code-review");
  reviews.record(lease, report("code-review"));
  store.transition(lease, "e2e-review");
  task("e2e-review");
  const e2e = new Reviews(store, "e2e-review");
  const evidence = (overrides = {}) =>
    report("e2e-review", {
      acceptance,
      workflows: [
        {
          kind: "success",
          scenario: "Trim outer spaces",
          expected: "Hello, Ada!",
          observed: "Hello, Ada!",
          passed: true,
        },
        {
          kind: "failure",
          scenario: "Reject null",
          expected: "TypeError",
          observed: "TypeError",
          passed: true,
        },
      ],
      ...overrides,
    });
  return { store, id, lease, project, reviews, e2e, task, report, evidence };
}
