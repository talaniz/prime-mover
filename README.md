# Prime Mover

The durable workflow engine behind DOOM Control Room.

You set the objective. Prime Mover moves the pieces.

## Status

Builds 001–008 implement the supervised Minimum Viable Application: authorized issue intake, durable isolated execution, independent code/E2E reviews, verified corrections, recovery, readiness notification and the linked DOOM Projects page. Independent product reviews and CI passed on the implementation head; release notes and final documentation-head review records are linked below. Production activation remains owner-gated and requires persistent boot-mount and kernel memory-limit verification. No unattended worker is running; nothing merges automatically.

## Intended workflow

1. Discover GitHub issues explicitly authorized for execution, initially using a `codex-ready` label applied by an authorized repository maintainer.
2. Persist and claim each job in SQLite, preventing duplicate execution.
3. Create an isolated Git worktree and use the existing Codex app server to implement the issue's acceptance criteria.
4. Verify the change and create a pull request.
5. Obtain independent code review, handle findings, and obtain sign-off on the current head commit.
6. Obtain separate end-to-end review, handle findings, and revalidate both reviews after fixes.
7. Notify the owner when the PR is ready for their merge approval. Never merge automatically.

Start with one implementation job at a time and GitHub polling rather than a public webhook receiver. Persist task identifiers, stage transitions, reviewed commit SHAs, and notification state. Recovery must inspect existing jobs and app-server tasks before taking further action. Missing verification or an exhausted retry budget must result in a visible blocked state, not success.

## Development storage on the Pi

The initial checkout is on the USB volume mounted at `/media/talaniz/postgresdata`:

```text
codex-work/
  repos/prime-mover/       # this Git checkout
  worktrees/              # future isolated job worktrees
  data/prime-mover/       # future SQLite databases and runtime state
```

`/home/palpatine/prime-mover` is a convenience symlink to this checkout. Runtime databases belong outside repository clones. The existing DOOM checkout and PostgreSQL/n8n directories have not been moved.

The drive is a roughly 30 GB USB flash device with a local ext4 filesystem. A temporary SQLite WAL database passed concurrent-reader, transaction-visibility, and integrity checks during initialization; the test database was removed. This is a functional check, not an endurance or power-loss test.

The mount currently uses the existing desktop-managed path and has no `/etc/fstab` entry. Before unattended worker deployment, configure and verify persistent mounting by filesystem UUID, startup dependencies, and database backups. Workers must refuse to start if the expected filesystem is missing or read-only; never silently create runtime state on the Pi's root filesystem at a missing mount path.

## Development and verification

Build 001 establishes the TypeScript/Node toolchain, configuration contracts and compatibility probes. Build 002 adds the durable store/scheduler, operator controls and metadata service. Build 003 adds opt-in issue intake; Build 004 adds bounded implementation and verified draft publication. Build 005 adds independent code review, public finding triage, bounded corrections and exact-head sign-off. Build 006 adds distinct E2E review, correction re-review, GitHub readiness gates and durable notification. Build 007 adds durable recovery and operational tooling; unattended activation remains owner-gated. Follow `AGENTS.md` and the user's global PR review workflow.

Current repository checks:

```sh
git status --short --branch
git remote -v
git diff --check
```

Credentials, environment-specific configuration, databases and their WAL/SHM sidecars must never be committed. GitHub authentication belongs to the local credential manager; Codex authentication stays with the existing app server.

## Execution harness

Start with [harness/README.md](harness/README.md) for the eight ordered build contracts,
test-first commit workflow, execution log, independent reviews, and release notes.
See [MVA release notes](harness/release-notes/mva.md) for verified scope, reviewed heads, evidence, limitations and remaining human actions. Final-head sign-offs and delivery status live on [Prime Mover PR #3](https://github.com/talaniz/prime-mover/pull/3) and [DOOM PR #14](https://github.com/talaniz/doom-control/pull/14).

## Default projects

The MVA configures `talaniz/prime-mover` and `talaniz/doom-control` (DOOM Dashboard), with one active job globally. The read-only Projects page in the linked DOOM PR shows tracking and job metadata, including stale/unavailable states. See [the contract](harness/project-metadata.md). Registry membership does not authorize individual issues or activate unattended intake. Manual project-add/edit controls are outside this milestone.

## Build 001 development commands

Use Node 22.23.2 and npm 10.9.8 (`.node-version`, `package-lock.json`).

```sh
npm ci
npm run build
npm run lint
npm test
npm run test:integration
npm run test:e2e
npm run check
node dist/cli.js config-check config.example.json
```

The current E2E command exercises configuration, backup/restore and intake-guard CLI workflows.
Complete live MVA acceptance is a separate gate. Integration tests exercise local Unix WebSockets and SQLite WAL.
See [architecture and contracts](docs/architecture.md) for schema, compatibility,
credential boundaries and the read-only metadata API. Runtime intake is not enabled.

The explicitly invoked live app-server probe uses an isolated external-volume folder
and a local ignored evidence file to retain task/turn IDs across observation retries:

```sh
node scripts/probe-app-server.mjs SOCKET ISOLATED_CWD EVIDENCE_JSON
```

Do not delete its evidence to retry an ambiguous operation. Reconcile the existing
task first. The probe cannot substitute for the later supervised MVA rehearsal.

## Local operator commands (Build 002)

Prepare ignored `config.local.json` from the example with the verified external
filesystem UUID and an owner-only metadata token file (at least 32 characters).
No command below enables GitHub polling or deploys a service.

```sh
node dist/cli.js doctor config.local.json
node dist/cli.js status config.local.json
node dist/cli.js inspect config.local.json JOB_ID
node dist/cli.js pause config.local.json
node dist/cli.js resume config.local.json
node dist/cli.js cancel config.local.json JOB_ID "operator reason"
node dist/cli.js retry config.local.json JOB_ID "what was corrected"
node dist/cli.js metadata config.local.json
```

Doctor makes read-only storage, credential and app-server checks without opening the
runtime database. Status initializes the registry/store only after mount preflight.
Pause stops new claims; existing work must unwind safely. Cancellation of remote work
remains a visible request until the coordinator confirms it stopped. Retry refuses
unresolved remote operations, active leases/turns and absent reasons; it never creates
a fresh execution generation. The foreground metadata server exposes read-only
HTTP over its private Unix socket and exits on SIGINT/SIGTERM.

Offline `npm run check` now includes real multi-process contention, killed-worker
persistence, fake-clock retries, cancellation, and authenticated metadata HTTP tests.
To repeat the disposable Pi operator rehearsal explicitly:

```sh
node scripts/rehearse-operator.mjs /media/talaniz/postgresdata VERIFIED_UUID
```

This uses a temporary subtree of codex-work, existing read-only GitHub/app-server
access and a temporary metadata server/token; it cleans up its own artifacts. It
never enables a worker service or changes the live DOOM deployment.

## Authorized intake (Build 003)

These commands contact GitHub and may publish acknowledgment comments in configured
repositories. Use a deliberately configured allowlist; `poll` performs one bounded
round, not an unattended service or agent execution.

```sh
node dist/cli.js poll config.local.json
node dist/cli.js reconcile-issue config.local.json JOB_ID "why the revised contract is accepted"
node dist/cli.js rerun config.local.json TERMINAL_JOB_ID "why a new generation is requested"
```

An open issue needs a current `codex-ready` label whose latest label event identifies
a configured maintainer. Its body must contain nonempty Objective, Scope, Acceptance
criteria, and Verification headings. Issue text is task data, never authority.
Incomplete authorized issues are blocked and receive one clarification acknowledgment.
Unauthorized issues do not queue. Missing or ambiguous actor evidence fails closed.

Repeated polls, restarts and label toggles preserve job/acknowledgment identity.
Material title/body edits block work until explicit `reconcile-issue`; ordinary
`retry` cannot accept a changed contract. Closure or withdrawal cancels pending work
and requests interruption of the exact owned active turn, retaining its reservation
until remote completion is confirmed. `rerun` requires an explicit reason and a
reconciled terminal generation; it creates an audited generation, never implicitly.

Each project has persistent pagination/backoff; repositories are polled independently.
Polling continues lifecycle checks while intake is paused. Before execution or task
publication, coordinators must call the fresh authorization guard. GitHub outages
block the affected project, and a slow repository does not delay the other one.

Acknowledgment intent is stored before POST. An ambiguous response is reconciled
against the complete comment body/unique marker and authenticated author's identity;
no match is **not** proof of non-delivery, so the worker never blindly reposts. Such
uncertainty remains blocked for operator recovery. Generic remote recovery belongs
to Build 007. GitHub list propagation can require a later poll; every completed
pagination cycle starts a fresh full scan.

Explicit live acceptance is isolated to private `talaniz/prime-mover-fixture`:

```sh
node scripts/rehearse-intake.mjs /media/talaniz/postgresdata VERIFIED_UUID harness/build/intake-evidence.json
```

It creates fixture issues/comments, verifies authorization, deduplication, edits,
withdrawal, explicit rerun and incomplete requirements, then closes/unlabels the
issues. Evidence and the isolated external-volume database are retained; failures
must be inspected before another run. It refuses to overwrite existing evidence.

## Supervised implementation (Build 004)

After explicitly polling authorized issues, run one queued implementation job:

```sh
node dist/cli.js run-once config.local.json
```

Set operator-owned `gitAuthor.name` and `gitAuthor.email` for commits in worker-owned
clones. Read-only commands accept older configurations without these fields; execution
requires them. This command creates an isolated worktree, runs a bounded app-server
turn, commits scoped output, runs configured checks and publishes one **draft** PR.
It does not run code/E2E review or mark a PR ready. It never merges or deploys.

Verification runs in bubblewrap with a private home, cleared environment and no
network; trusted setup may use network without host credential mounts. Task execution
uses the existing daemon's workspace sandbox and approval controls. Unresolved
approvals and uncertain remote state retain the job reservation; do not start a
replacement task or delete its database to retry.

When implementation is proven complete but publication was blocked by a corrected
operator configuration, an explicit continuation preserves the original task, commit
intent and elapsed budget:

```sh
node dist/cli.js resume-publication config.local.json JOB_ID "what was corrected"
```

The continuation first verifies the recorded owned task is idle and its turn completed,
then refreshes issue authorization. It refuses active/failed/unknown turns, changed
contracts, cancellation and other reservations. General crash recovery remains a
Build 007 gate. Inspect uncertain verification/PR intents rather than blindly repeat.

The live fixture script creates a private fixture issue and leaves its draft PR for
later review acceptance. It refuses an existing evidence file:

```sh
node scripts/rehearse-implementation.mjs /media/talaniz/postgresdata VERIFIED_UUID harness/build/implementation-evidence.json
```


## Supervised code review (Build 005)

Start independent code review for an already published job:

```sh
node dist/cli.js code-review config.local.json JOB_ID
```

The reviewer receives every new commit, combined diff, issue contracts and verification
evidence. Findings and main-task dispositions are attributed in PR comments. Accepted
corrections use the original implementation task and verification commands; the same
independent reviewer revalidates the new head. Comments are not formal GitHub approvals.
The stage completes at `e2e-review`; this does not mark the PR ready.

If a completed review turn was blocked during coordination, explicitly continue after
inspecting the blocker:

```sh
node dist/cli.js resume-code-review config.local.json JOB_ID "what was corrected"
```

Continuation requires authoritative completed-turn proof, fresh issue authorization,
no live lease or competing reservation, and recognized persisted operations. Original
task identities, intents and elapsed budgets are preserved. Unknown task/turn creation
or external publication state cannot be cleared by this command. Unresolved reviewer
limitations block sign-off; bounded clarification asks the reviewer to distinguish
resolved tooling issues from remaining gaps without changing its verdict ourselves.

The supervised live fixture gate is `scripts/rehearse-review.mjs MOUNT VERIFIED_UUID
EVIDENCE_PATH`. It deliberately seeds a defect in a private fixture PR, verifies the
finding/correction/sign-off cycle, and refuses existing evidence or open authorized
fixtures. Inspect and reconcile failures before any new run.


## Supervised E2E and readiness (Build 006)

After current-head code sign-off, run the distinct E2E reviewer:

```sh
node dist/cli.js e2e-review config.local.json JOB_ID
node dist/cli.js recheck-ready config.local.json JOB_ID
```

E2E must exercise actual successful and failing user workflows against the full
acceptance contract. Its task differs from both implementation and code review.
Accepted corrections return through code re-review before E2E can sign off again.
All corrections share the persistent budget; task/review rounds remain bounded.

Readiness requires matching code/E2E head and base, no unresolved findings or evidence
gaps, passing configured verification, fresh GitHub checks/requirements and an open,
conflict-free PR. Missing or ambiguous evidence blocks. The coordinator posts one
attributed comment mentioning the configured maintainers and containing the exact
head, checks, review links and remaining human actions. Lost responses reconcile the
stored marker/body/author; uncertain absence never triggers a blind repeat POST.
The worker records `ready` only after a fresh post-notification recheck. The generated
PR remains a draft; merge and deployment require human approval.

`recheck-ready` refreshes authorization, workspace/PR identity and GitHub check state.
A failed or unavailable check revokes local readiness into a visible blocker. This
command is supervised; Build 007 service cycles also perform periodic rechecking. The public readiness comment identifies its verified snapshot and does not
promise that later changes retain readiness or that email/push was delivered.

If checks recover without a code/contract change, inspect the blocker, then use the
existing explicit `resume-code-review` continuation with a reason and `e2e-review`.
Completed-turn proof and current-head evidence must still pass. The verified fixture
reused both sign-offs and the single notification without a new model turn or budget
reset. Unknown pending operations and expired budgets remain blocked for reconciliation.

Live gates: `scripts/rehearse-e2e.mjs CODE_REVIEW_EVIDENCE NEW_EVIDENCE` continues the
owned private fixture. `scripts/rehearse-readiness-recovery.mjs E2E_EVIDENCE NEW_EVIDENCE`
injects a failed fixture commit status, checks revocation, restores that status and
proves recovery without duplicate tasks/notifications. Both preserve evidence and
refuse to overwrite an earlier attempt. They do not modify production services.


## Recovery and service operations (Build 007)

```sh
node dist/cli.js recover-once config.local.json
node dist/cli.js cycle config.local.json
node scripts/worker-service.mjs config.local.json 2
node dist/cli.js service-preflight config.local.json
node dist/cli.js backup config.local.json RUNTIME_ROOT/backups/snapshot.sqlite
node dist/cli.js restore-check config.local.json RUNTIME_ROOT/backups/snapshot.sqlite RUNTIME_ROOT/restores/check/jobs.sqlite
```

`recover-once` reconciles interrupted ownership without claiming a new queued job.
`cycle` reconciles first, rechecks ready results, then advances one review stage or
performs intake and one implementation. The supervisor repeats sequential cycles;
omitting the finite-cycle argument runs until stopped or its failure limit is reached.
Standalone `poll` refuses live/expired ownership or pending execution intents: reconcile
first. SIGTERM stops new execution and observes/interrupts only owned work; uncertain
reservations remain durable. Backups are SQLite-consistent database snapshots, and
restore checks leave isolated copies paused.

See [recovery and fault evidence](docs/recovery.md) and
[service operations](docs/service-operations.md) for retention, upgrade/rollback,
service templates, persistent mount setup and the verified deployment limitations.
This Pi currently boots with `cgroup_disable=memory`; service preflight refuses
unattended activation until kernel memory accounting and actual limits are verified.
No templates have been installed/enabled, and no boot settings have been changed.

## MVA acceptance evidence

See [the acceptance index](docs/mva-acceptance.md) for the eight criteria, actual fixture
PR/review/notification evidence, DOOM integration, fresh-checkout commands and remaining
review/deployment gates. The product PRs remain subject to independent final-head reviews.
