# Prime Mover

The planned durable workflow engine behind DOOM Control Room.

You set the objective. Prime Mover moves the pieces.

## Status

Builds 001–004 implement integration contracts, durable scheduling, operator controls, project metadata, maintainer-authorized GitHub intake and supervised isolated implementation through a draft PR. The review pipeline and DOOM Projects page remain under development. No unattended worker is running; nothing merges automatically.

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

`/home/palpatine/prime-mover` is a convenience symlink to this checkout. Runtime databases belong outside repository clones; the data directory is currently empty. The existing DOOM checkout and PostgreSQL/n8n directories have not been moved.

The drive is a roughly 30 GB USB flash device with a local ext4 filesystem. A temporary SQLite WAL database passed concurrent-reader, transaction-visibility, and integrity checks during initialization; the test database was removed. This is a functional check, not an endurance or power-loss test.

The mount currently uses the existing desktop-managed path and has no `/etc/fstab` entry. Before unattended worker deployment, configure and verify persistent mounting by filesystem UUID, startup dependencies, and database backups. Workers must refuse to start if the expected filesystem is missing or read-only; never silently create runtime state on the Pi's root filesystem at a missing mount path.

## Development and verification

Build 001 establishes the TypeScript/Node toolchain, configuration contracts and compatibility probes. Build 002 adds the durable store/scheduler, operator controls and metadata service. Build 003 adds opt-in issue intake; Build 004 adds bounded implementation and verified draft publication. Independent reviews and full recovery remain future builds. Follow `AGENTS.md` and the user's global PR review workflow.

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
The application milestone is in progress; Build 001 contracts and compatibility checks
are complete. The durable store/scheduler, metadata backend and authorized intake are implemented through Build 004; the complete review pipeline and dashboard remain under development.

## Planned default projects

The MVA will track `talaniz/prime-mover` and `talaniz/doom-control` (DOOM Dashboard),
with one active job globally. A read-only Projects page in the existing DOOM Dashboard
will show tracking and job metadata. See [the contract](harness/project-metadata.md).
The default registry and metadata backend are implemented through Build 002; the DOOM view remains pending. No unattended intake is activated.

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

The current E2E command exercises the actual configuration CLI, not the future
complete worker. Integration tests exercise local Unix WebSockets and SQLite WAL.
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
