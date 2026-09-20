# Build 001 — Contracts and integration boundaries

Milestone: **Minimum Viable Application** (the only milestone).
Dependency: Harness preparation baseline.
Status: **pending**; committing this contract does not execute it.
Primary implementation commit trailer: `Build: 001`.

## Scope and deliverables

Choose and lock the Pi-compatible runtime, package manager, SQLite driver and test runner. Implement typed configuration validation and external-adapter boundaries. Inspect the installed Codex app-server protocol and establish compatibility, task lifecycle, recovery and approval assumptions. Verify GitHub repository/maintainer access; define issue and PR templates, credential boundaries, required checks and execution limits.

Deliver: Runtime scaffold, lockfile, config schema/example, adapter interfaces, templates, documented runnable checks and compatibility evidence.

## Acceptance criteria

- Valid allowlisted repository/runtime configuration passes; missing credentials, unsafe paths and unsupported app-server capabilities fail with actionable diagnostics.
- Actual installation, build, lint, unit, integration and E2E commands are documented, distinguishing offline CI checks from credential-dependent live checks.
- A harmless isolated live app-server task completes and read-only GitHub probes identify the repository and authorization evidence. No second CLI execution backend is introduced.

## Project metadata scope and required verification

Define and validate the two default projects and versioned read-only metadata contract in [project metadata](../project-metadata.md). Lock transport authentication, freshness bound and per-project commands/allowlists. Tests must cover idempotent defaults, preserved operator settings and invalid/missing project configuration; read-only GitHub probes verify both repositories.

## Verification contract — red first

Before coding, resolve the concrete commands, fixtures and expected assertion failures
in the execution log. Build 001 establishes the runner; later builds reuse it.

- Write configuration validation tests for valid configuration and each invalid boundary; fail on the unimplemented validator for the asserted behavior.
- Write adapter contract tests against recorded/redacted protocol shapes for task start/events, approval waits and reconnect inspection.

## Verification contract — green and regression

- Run the same validator/adapter tests to green plus the new build/lint commands.
- Run a live harmless task and GitHub read-only probe; record runtime/protocol versions and observable recovery capabilities. Unavailable credentials block the live acceptance gate.

## Commit and exit gate

Follow the branch → tests → meaningful red → implementation → green → verification →
log → commit loop in ../../AGENTS.md. Commit tests, implementation and log evidence
together in exactly one primary commit for this build; no red-only commit. Record
commands, exit statuses, representative assertions, environment and durable evidence.
Document blockers and deviations honestly. Complete all build acceptance checks before
advancing; final PR reviews/release notes occur after the implementation builds.
Review fixes use separate `Fixes-Build: 001` commits on the same PR. Never merge or deploy.
