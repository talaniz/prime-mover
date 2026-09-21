import test from "node:test";
import assert from "node:assert/strict";
import * as recovery from "../../dist/startup-recovery.js";
const op = (key, kind, status = "pending", result = null) => ({
  key,
  kind,
  status,
  result,
  input: {},
});
for (const [name, pr, ops, expected] of [
  [
    "unpublished implementation",
    null,
    [],
    { stage: "preparing", role: "implementation" },
  ],
  ["initial code review", 1, [], { stage: "code-review", role: "code-review" }],
  [
    "interrupted code fix",
    1,
    [
      op("review-cycle:1", "review-cycle"),
      op("code-fix-1:correction", "review-fix"),
    ],
    { stage: "code-fixes", role: "code-review" },
  ],
  [
    "interrupted E2E fix",
    1,
    [
      op("e2e-review-cycle:1", "e2e-review-cycle"),
      op("e2e-fix-1:correction", "review-fix"),
    ],
    { stage: "e2e-fixes", role: "e2e-review" },
  ],
  [
    "E2E fix published before its cycle completes",
    1,
    [
      op("e2e-review-cycle:1", "e2e-review-cycle"),
      op("e2e-fix-1:correction", "review-fix", "done", { head: "new" }),
    ],
    { stage: "verifying", role: "e2e-review" },
  ],
  [
    "E2E fix cycle completed before fresh code review",
    1,
    [
      op("e2e-review-cycle:1", "e2e-review-cycle", "done"),
      op("e2e-fix-1:correction", "review-fix", "done", { head: "new" }),
    ],
    { stage: "code-review", role: "e2e-review" },
  ],
  [
    "nested code review must finish before E2E continues",
    1,
    [
      op("e2e-review-cycle:1", "e2e-review-cycle", "done"),
      op("review-cycle:2", "review-cycle"),
    ],
    { stage: "code-review", role: "e2e-review" },
  ],
  [
    "current code signoff permits E2E continuation",
    1,
    [
      op("e2e-review-cycle:1", "e2e-review-cycle", "done"),
      op("e2e-fix-1:correction", "review-fix", "done", { head: "new" }),
      op("code-review-2:round", "review-round", "done", {
        head: "new",
        verdict: "sign-off",
      }),
    ],
    { stage: "e2e-review", role: "e2e-review" },
  ],
])
  test(name, () =>
    assert.deepEqual(recovery.recoveryRoute({ prNumber: pr }, ops), expected),
  );
