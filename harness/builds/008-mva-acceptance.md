# Build 008 — Complete minimum viable application acceptance

Milestone: **Minimum Viable Application** (the only milestone).
Dependency: 007.
Status: **implemented and verified**; implementation CI and independent product
reviews passed. Release notes are recorded; final documentation-head sign-offs and
delivery status are authoritative on the product PRs. See the execution log and
[acceptance index](../../docs/mva-acceptance.md) for actual evidence.
Primary implementation commit trailer: `Build: 008`.

## Scope and deliverables

Build the final supervised acceptance harness and run against a designated disposable repository using real GitHub and the installed app server. Prove intake through implementation/checks/PR/reviews/readiness plus controlled failure and restart. Finalize CI, fresh-checkout instructions, operating documentation and evidence index. Independently review Prime Mover itself after this build commit.

Deliver: Final acceptance tests/integration, CI, verified runbooks and MVA evidence index; later review-fix and release-note commits remain on this PR.

## Acceptance criteria

- Fresh checkout installs/builds and passes documented deterministic checks in CI; credentials are not exposed to untrusted tests.
- Live acceptance proves authorized intake, single-job isolation, durable recovery, implementation PR, independent sequential reviews, honest readiness notification and operator controls.
- All eight MVA criteria in the Drive plan have evidence; no merge/deploy occurs. All product builds are on one milestone PR.
- Application completion is claimed only after that PR receives both independent reviews, release notes derived from the log, and both final-head revalidations.

## Project metadata scope and required verification

Require all eight MVA criteria, including MVA-8 project visibility, with the [project metadata](../project-metadata.md) browser walkthrough and failure scenarios. Verify two-project defaults/intake/global concurrency and the read-only DOOM Projects page against recorded Prime Mover and DOOM integration heads. The linked DOOM integration PR is part of this MVA and needs independent final-head reviews; missing dashboard or integrated evidence blocks readiness. Do not mutate production issues merely to prove defaults.

## Verification contract — red first

Before coding, resolve the concrete commands, fixtures and expected assertion failures
in the execution log. Build 001 establishes the runner; later builds reuse it.

- Write end-to-end acceptance scenarios asserting observable outcomes and missing evidence failures before final integration glue. At least one meaningful missing final-integration behavior must fail; do not fabricate a failure.
- Add negative scenarios for a controlled failing check, review finding, restart mid-job and unresolved blocker. If these already pass, record the observation and clarify the remaining implementation scope before claiming red/green.

## Verification contract — green and regression

- Run acceptance scenarios to green in the designated environment and CI-safe checks from a fresh checkout. Record exact commands, fixture PR, task IDs and redacted evidence.
- Commit this build after implementation verification; then run the external code-review and independent E2E-review cycles on the milestone PR. Add notes only after sign-offs and revalidate final head before notifying the owner.

## Commit and exit gate

Follow the branch → tests → meaningful red → implementation → green → verification →
log → commit loop in ../../AGENTS.md. Commit tests, implementation and log evidence
together in exactly one primary commit for this build; no red-only commit. Record
commands, exit statuses, representative assertions, environment and durable evidence.
Document blockers and deviations honestly. Complete all build acceptance checks before
advancing; final PR reviews/release notes occur after the implementation builds.
Review fixes use separate `Fixes-Build: 008` commits on the same PR. Never merge or deploy.
