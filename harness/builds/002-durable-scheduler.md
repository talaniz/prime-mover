# Build 002 — Durable scheduling and operator controls

Milestone: **Minimum Viable Application** (the only milestone).
Dependency: 001.
Status: **pending**; committing this contract does not execute it.
Primary implementation commit trailer: `Build: 002`.

## Scope and deliverables

Implement SQLite migrations, durable jobs/events/attempts/outbox, atomic claiming, leases/heartbeats and stage guards. Enforce one active job and one active agent turn. Implement doctor/status/inspect, persistent pause/resume, cancel and audited blocked-job retry. Store external-operation intents before side effects and reconcile before retries.

Deliver: Scheduler/store/CLI, schema migrations, durable operation intents, contention and restart tests.

## Acceptance criteria

- Competing worker processes cannot claim the same job or exceed the global cap; stale lease holders cannot continue mutation.
- Restart preserves stages, budgets, pause state and pending operations; migrations preserve prior records.
- Cancellation and retry produce auditable stable states; unsupported transitions fail. An expired lease never proves an old remote turn stopped.

## Project metadata scope and required verification

Implement the persistent project registry and metadata projection in [project metadata](../project-metadata.md). Test two-project global job/turn contention, restart-safe settings and read-only metadata including empty/paused/blocked/stale states, authentication, redaction and no execution side effects.

## Verification contract — red first

Before coding, resolve the concrete commands, fixtures and expected assertion failures
in the execution log. Build 001 establishes the runner; later builds reuse it.

- Write real SQLite transactional contention and migration tests with isolated temporary databases. Assert duplicate-claim and invalid-transition failures before scheduler implementation.
- Use a fake clock to prove lease expiry, persisted pause and retry delays.

## Verification contract — green and regression

- Run real-database concurrency/migration tests to green and all established checks.
- Kill/restart the worker with fake external adapters; inspect durable state and demonstrate CLI pause/cancel/retry behavior.

## Commit and exit gate

Follow the branch → tests → meaningful red → implementation → green → verification →
log → commit loop in ../../AGENTS.md. Commit tests, implementation and log evidence
together in exactly one primary commit for this build; no red-only commit. Record
commands, exit statuses, representative assertions, environment and durable evidence.
Document blockers and deviations honestly. Complete all build acceptance checks before
advancing; final PR reviews/release notes occur after the implementation builds.
Review fixes use separate `Fixes-Build: 002` commits on the same PR. Never merge or deploy.
