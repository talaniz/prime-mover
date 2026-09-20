# Build 003 — Authorized GitHub issue intake

Milestone: **Minimum Viable Application** (the only milestone).
Dependency: 002.
Status: **pending**; committing this contract does not execute it.
Primary implementation commit trailer: `Build: 003`.

## Scope and deliverables

Poll allowlisted repositories initially every 60 seconds with pagination, checkpoint safety, reconciliation and rate-limit backoff. Require codex-ready applied by an authorized maintainer, verified through event evidence. Snapshot issue/acceptance criteria, create a unique job and reconcile one acknowledgment comment. Treat issue content as untrusted data.

Deliver: Poller, authorization policy, issue snapshots, deduplication and lifecycle handling with fixture evidence.

## Acceptance criteria

- Only authenticated maintainer authorization with a testable contract can queue work; missing actor evidence blocks.
- Repeated pages, polls and label toggles cannot duplicate execution or acknowledgments. Explicit reruns create audited generations.
- Closure or authorization withdrawal stops new turns and interrupts active work where supported. Material issue edits pause for contract reconciliation.

## Project metadata scope and required verification

Apply [project metadata](../project-metadata.md) to intake for both default repositories. Test independent authorization/checkpoints, identical issue numbers across repositories, repeated pages and fair progress when one project is busy or unavailable. One global active job/turn remains the limit.

## Verification contract — red first

Before coding, resolve the concrete commands, fixtures and expected assertion failures
in the execution log. Build 001 establishes the runner; later builds reuse it.

- Write GitHub-adapter tests for unauthorized labeling, missing criteria, duplicate pages/events and issue edits before intake implementation.
- Assert expected persistent outcomes for 403/429, outage, removed label and closed issue.

## Verification contract — green and regression

- Run the same intake tests to green, including poll-checkpoint interruption and reconciliation.
- Use designated fixture issues to verify actor identity and acknowledgment without enabling unrestricted intake.

## Commit and exit gate

Follow the branch → tests → meaningful red → implementation → green → verification →
log → commit loop in ../../AGENTS.md. Commit tests, implementation and log evidence
together in exactly one primary commit for this build; no red-only commit. Record
commands, exit statuses, representative assertions, environment and durable evidence.
Document blockers and deviations honestly. Complete all build acceptance checks before
advancing; final PR reviews/release notes occur after the implementation builds.
Review fixes use separate `Fixes-Build: 003` commits on the same PR. Never merge or deploy.
