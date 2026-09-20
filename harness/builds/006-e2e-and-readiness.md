# Build 006 — Independent E2E review and readiness

Milestone: **Minimum Viable Application** (the only milestone).
Dependency: 005.
Status: **pending**; committing this contract does not execute it.
Primary implementation commit trailer: `Build: 006`.

## Scope and deliverables

Create a separate E2E task only after current-head code sign-off. Exercise actual acceptance workflows and failure cases. Route fixes through verification and code re-review. Gate readiness on matching review SHAs, passing required checks, satisfied criteria and no blockers. Persist notification intents and reconcile one logical readiness comment mentioning the owner.

Deliver: E2E coordination, current-head readiness gates and durable notification delivery.

## Acceptance criteria

- A seeded workflow failure blocks readiness until verified fixes receive both sign-offs on the same head.
- Changed head/base, conflicts, failed required checks and unavailable environments prevent or revoke readiness.
- A single logical ready notification includes PR/head, check and review evidence and remaining human approvals; retries reconcile its marker. No automatic merge/deploy path exists.

## Verification contract — red first

Before coding, resolve the concrete commands, fixtures and expected assertion failures
in the execution log. Build 001 establishes the runner; later builds reuse it.

- Write readiness truth-table tests for missing/stale reviews, checks, criteria and unresolved findings.
- Test E2E-fix return to code review and notification failure before/after remote acceptance, including ambiguous response.

## Verification contract — green and regression

- Run state/outbox tests to green; demonstrate stale-head invalidation and recovery.
- Use a distinct reviewer on the live fixture and verify the readiness comment and attribution. Email/push delivery depends on user GitHub preferences and is not assumed.

## Commit and exit gate

Follow the branch → tests → meaningful red → implementation → green → verification →
log → commit loop in ../../AGENTS.md. Commit tests, implementation and log evidence
together in exactly one primary commit for this build; no red-only commit. Record
commands, exit statuses, representative assertions, environment and durable evidence.
Document blockers and deviations honestly. Complete all build acceptance checks before
advancing; final PR reviews/release notes occur after the implementation builds.
Review fixes use separate `Fixes-Build: 006` commits on the same PR. Never merge or deploy.
