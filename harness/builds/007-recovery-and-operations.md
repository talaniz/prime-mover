# Build 007 — Recovery and Raspberry Pi operations

Milestone: **Minimum Viable Application** (the only milestone).
Dependency: 006.
Status: **pending**; committing this contract does not execute it.
Primary implementation commit trailer: `Build: 007`.

## Scope and deliverables

Complete startup reconciliation and bounded attempts/time budgets. Handle worker/app-server restart, network/auth failures, storage loss, pending approvals and conflicts. Ship service templates, mount/space/resource preflight, redacted diagnostics, retention and SQLite-consistent backup/restore procedures. Preserve unrelated DOOM/PostgreSQL/n8n services and data.

Deliver: Recovery matrix, operational preflight, service templates, bounded budgets, backup/restore and operator runbooks.

## Acceptance criteria

- Every nonterminal job and pending operation is reconciled before intake; uncertainty blocks instead of duplicating an active turn.
- The expected external filesystem must be mounted and writable; missing/read-only/full storage cannot create fallback state on the Pi root volume.
- Retry/time budgets survive restart; exhaustion is visibly blocked. Backup restore into an isolated directory preserves integrity and resumable state.
- Service boot ordering and app-server dependency are proven in a supervised environment; production activation remains separately authorized.

## Verification contract — red first

Before coding, resolve the concrete commands, fixtures and expected assertion failures
in the execution log. Build 001 establishes the runner; later builds reuse it.

- Write injectable filesystem/mount and budget-clock tests; fail safe before opening SQLite when storage is wrong.
- Add fault tests before and after each GitHub/app-server side effect and tests for disconnected active turns, lease loss and approval waits.

## Verification contract — green and regression

- Run fault matrix to green and record observed continuation or explicit blocked outcome at every boundary.
- Rehearse service restart, consistent backup and isolated restore; record Pi disk/memory usage and adjust limits based on evidence without disrupting existing data.

## Commit and exit gate

Follow the branch → tests → meaningful red → implementation → green → verification →
log → commit loop in ../../AGENTS.md. Commit tests, implementation and log evidence
together in exactly one primary commit for this build; no red-only commit. Record
commands, exit statuses, representative assertions, environment and durable evidence.
Document blockers and deviations honestly. Complete all build acceptance checks before
advancing; final PR reviews/release notes occur after the implementation builds.
Review fixes use separate `Fixes-Build: 007` commits on the same PR. Never merge or deploy.
