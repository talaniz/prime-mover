# Build 004 — App-server implementation and PR creation

Milestone: **Minimum Viable Application** (the only milestone).
Dependency: 003.
Status: **pending**; committing this contract does not execute it.
Primary implementation commit trailer: `Build: 004`.

## Scope and deliverables

Create deterministic branches and isolated worktrees at a recorded base SHA. Start implementation through the existing app server with repository instructions, issue snapshot and verification contract. Persist task/turn IDs, bound execution, handle approvals honestly, run trusted configured commands, collect evidence, commit/push and reconcile one PR.

Deliver: Git/worktree manager, app-server execution adapter, verification runner and idempotent PR publication.

## Acceptance criteria

- A fixture issue produces the required change, passing checks, coherent commits and one PR with acceptance/evidence.
- No implementation occurs in the live DOOM checkout; unrelated tasks remain untouched. Worker command arguments cannot be injected from issue text.
- Failed checks, no-op output, unresolved approvals and ambiguous remote side effects never count as completion; retries reconcile existing tasks/branches/PRs.

## Project metadata scope and required verification

For both defaults in [project metadata](../project-metadata.md), test isolated execution and correct repository attribution. Self-development must not change/reload the running Prime Mover service, and DOOM work must not edit its live checkout.

## Verification contract — red first

Before coding, resolve the concrete commands, fixtures and expected assertion failures
in the execution log. Build 001 establishes the runner; later builds reuse it.

- Write worktree isolation, command argument and turn-event tests; prove checks prevent a PR-ready state when implementation or verification is absent.
- Add crash-point tests around task start, branch creation, push and PR creation, including lost responses.

## Verification contract — green and regression

- Run these tests and regression checks to green.
- Run an actual small fixture issue through app-server implementation/checks/PR creation; record task IDs, head/base, commands and PR URL.

## Commit and exit gate

Follow the branch → tests → meaningful red → implementation → green → verification →
log → commit loop in ../../AGENTS.md. Commit tests, implementation and log evidence
together in exactly one primary commit for this build; no red-only commit. Record
commands, exit statuses, representative assertions, environment and durable evidence.
Document blockers and deviations honestly. Complete all build acceptance checks before
advancing; final PR reviews/release notes occur after the implementation builds.
Review fixes use separate `Fixes-Build: 004` commits on the same PR. Never merge or deploy.
