# Build 005 — Independent code-review cycle

Milestone: **Minimum Viable Application** (the only milestone).
Dependency: 004.
Status: **complete**; live seeded-defect correction and exact-head independent sign-off verified. See the execution log for evidence.
Primary implementation commit trailer: `Build: 005`.

## Scope and deliverables

After a PR exists, create a distinct code-review task. Supply every new commit, combined diff, contracts and evidence. Persist findings/dispositions and SHA-bound sign-off. The coordinator assesses scope and validity, writes accepted-finding contracts, performs fixes, posts evidence/reasons and obtains reviewer revalidation.

Deliver: Code-review coordinator, review record schema, finding triage and attributed PR reports.

## Acceptance criteria

- Every new commit and aggregate diff are reviewed; sign-off identifies the current exact SHA.
- A seeded defect leads to a finding, verified fix and fresh reviewer sign-off; deferred/rejected findings have public rationale.
- New commits invalidate stale sign-off. E2E cannot start before code sign-off. Missing reviewer tools/evidence block. Review comments do not impersonate formal GitHub approvals.

## Verification contract — red first

Before coding, resolve the concrete commands, fixtures and expected assertion failures
in the execution log. Build 001 establishes the runner; later builds reuse it.

- Write state-machine tests rejecting stale SHA sign-off and premature E2E entry.
- Seed reviewer findings and test accepted/rejected/disputed dispositions, missing report evidence and fix-loop budgets before implementing the coordinator.

## Verification contract — green and regression

- Run state/adapter tests to green and relevant regressions.
- Exercise a live independent review on the fixture PR; retain exact-head findings, triage replies, fix evidence and sign-off.

## Commit and exit gate

Follow the branch → tests → meaningful red → implementation → green → verification →
log → commit loop in ../../AGENTS.md. Commit tests, implementation and log evidence
together in exactly one primary commit for this build; no red-only commit. Record
commands, exit statuses, representative assertions, environment and durable evidence.
Document blockers and deviations honestly. Complete all build acceptance checks before
advancing; final PR reviews/release notes occur after the implementation builds.
Review fixes use separate `Fixes-Build: 005` commits on the same PR. Never merge or deploy.
