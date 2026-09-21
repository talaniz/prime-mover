# MVA architecture and Build 001 decisions

## Runtime

Use TypeScript 5.9.3 compiled to ESM on Node 22.23.2, npm 10.9.8 and the native
Node test runner. package-lock.json pins the graph; .node-version pins the tested
runtime. Node's built-in SQLite (3.51.3 on this Pi) avoids native addon installation.
Its Node 22 API is experimental: preserve the tested Node line, expose the warning,
and repeat driver/WAL/recovery acceptance before upgrading. ws 8.21.3 provides
WebSocket-over-Unix transport with compression disabled. There is no CLI execution
backend: the worker connects to the already running Codex app-server daemon.

Strict TypeScript checking (including unused declarations) is the current lint gate;
there is no separate style-linter dependency. Unit tests cover pure boundaries;
integration tests exercise actual Unix WebSockets and SQLite; CLI E2E spawns the
compiled executable. These offline suites are distinct from credential-dependent
live acceptance and the future complete worker/dashboard E2E in Build 008.

## Configuration and trust

`src/config.ts` defines the typed runtime configuration schema and validates unknown
JSON. `config.example.json` seeds prime-mover and doom-dashboard. Copy it to ignored
`config.local.json`, replace the filesystem UUID using verified mount evidence and
configure trusted commands, required checks and allowed paths for each repository.
Validation checks shape and lexical paths; realpath/device/mount/writability checks
must run before runtime state opens (Build 007, with storage guards added when the
store starts in Build 002). A placeholder UUID is not operational readiness.

Configuration is operator-owned, never derived from issue text. Commands are argv
arrays, executed without a shell. Environment credentials are not config values.
GitHub uses the existing gh credential manager; Codex uses its existing authenticated
daemon. The metadata bearer secret is stored in a private file outside Git. Missing
credential/access evidence and unreviewed protocol versions must fail preflight.
Allowed paths limit output changes as well as the agent's supplied scope; workspace
sandboxing and isolated external-volume worktrees remain mandatory.

Both projects default to main and enabled tracking after explicit worker activation;
registry membership never authorizes execution. The issue must carry an allowlisted
maintainer's codex-ready event and a testable contract. Intake activation, deployment,
merge and adding arbitrary repositories are not side effects of config-check.
The initial configured requiredChecks arrays are empty because no concrete CI checks
have yet been established by this baseline; verification commands remain mandatory.
Add established CI check names with the Build 008 workflow and document the distinction.

## App-server compatibility and recovery

Supported baseline: installed Codex 0.155.1 protocol, generated using
`codex app-server generate-ts --experimental --out harness/build/protocol`.
Core methods: initialize/initialized, thread/start, thread/read (metadata),
thread/resume, thread/turns/list (paginated), turn/start and turn/interrupt.
Never substitute notLoaded or unknown for idle. History and current active state
must both be reconciled; a expired lease does not imply a remote turn stopped.
Request IDs multiplex responses; connection failure or timeout is ambiguous and
never triggers an automatic transport retry of a side effect. Persist an operation
intent and returned task/turn ID in the durable coordinator before follow-up work.

New/resumed tasks use on-request, auto_review and workspace-write; the live probe
verified the corresponding returned workspaceWrite sandbox. Approval/user-input
requests are emitted to the coordinator as waiting evidence, never auto-accepted by
the transport. Automated review is performed by the daemon's configured reviewer.
Pending requests remain visible for owner action and must block further scheduling.
A malformed message, unknown status or unrecognized required capability fails closed.
Sensitive remote error messages are replaced with a redacted code and recovery hint.

Protocol source: https://learn.chatgpt.com/docs/app-server . Installed generated types
and the live probe take precedence over assumed example spellings. The protocol uses
sandbox 'workspace-write' on thread creation and sandbox.type 'workspaceWrite' in
responses. History pagination must continue until the sought recorded turn is found
or a bounded explicit block is returned; do not start a replacement on an empty page.

## Metadata v1 contract (implementation begins in Build 002)

Prime Mover serves HTTP over an external-volume Unix socket, mode 0600, to the DOOM
server running as the same owner. Additionally require a timing-safe bearer token
from a mode-0600 owner-only file; DOOM keeps this token server-side. No TCP/public
worker listener or browser mutation API is part of this interface.

GET /v1/projects returns `MetadataSnapshot` from src/contracts.ts; GET
/v1/projects/:id returns the same envelope restricted to one allowed project.
All responses use Cache-Control: no-store. Unknown IDs return 404, missing/invalid
auth 401, unsupported methods 405. Registry/job snapshots are read-only. Tokens,
local paths, commands, environments and transcripts never enter the projection.
Repository/issue/PR links are canonical GitHub URLs for the configured allowlist.

`observedAt` timestamps projection generation, `lastPollAt` records last successful
GitHub poll, and freshnessSeconds is 120 by default. DOOM distinguishes source
availability from poll freshness and never equates a fresh projection to fresh
GitHub data. Failed refresh immediately marks a cached snapshot stale; elapsed
freshness also does so. No snapshot means unavailable, not an empty project list.
No job history is a normal empty state. Display global intake pause independently
of per-project tracking. Detailed dashboard contract: ../harness/project-metadata.md.

## Delivery

Builds 001–008 remain one Prime Mover milestone branch/PR. The existing DOOM Dashboard
Projects page has one linked integration PR in its own repository, within this MVA.
Both reviewed heads and schema version must be recorded in integrated acceptance.
Never modify the live DOOM checkout or reload either production service during
implementation. Merge and deployment await separate user authorization.

## Build 002 durable scheduling and metadata

`Store` owns SQLite schema version 1, WAL/FULL-synchronous transactions, append-only
transition events, claim attempts, persistent budget counters, operation intents and
notification outbox. Reopen is idempotent; unknown newer schema versions fail closed.
The configured project registry retains operator enable/disable settings on reseed;
removed projects cannot be newly claimed. Jobs and generations are repository-scoped.

Partial unique indexes enforce one lease and one recorded active turn globally.
Claims use BEGIN IMMEDIATE and project last-claim time for fair selection. Every
worker mutation checks owner, epoch and unexpired lease. Expiry retains ownership:
a crashed worker never grants permission to create a replacement remote turn.
Pending external-operation or notification intents also prevent new claims. Their
results must be reconciled, not erased or blindly retried. Automatic external-state
reconciliation is a later Build 007 gate, not implemented by lease expiry.

The scheduler accepts a fake or real async adapter with a fenced lease, abort signal
and assertActive check. It heartbeats while work is active and signals cancellation
or lease loss. Adapters must honor cancellation and check ownership before side
effects; the transport alone does not enforce scheduling. An uncertain live turn
keeps the job reserved and returns reconciliation-required. Cancellation is terminal
only after observed remote completion/interruption and resolved pending operations.
Retry keeps the same generation and counters; a future explicit rerun is a distinct
operation. Retry deadlines persist and use a clock injectable in tests.

Metadata queries read registry, jobs and global pause in one SQLite read transaction.
They project only public fields. `pollState` is fresh/stale/never-polled and is separate
from snapshot observation time. Blocker codes map to safe fixed messages; raw failure
text and stored issue snapshots are never returned. GET cannot create jobs or change
operator state. The Unix socket and token are owner-only. CLI startup holds an owner-private adjacent file lock through the listener lifetime.
It preserves active/uncertain listeners and non-socket paths; an owned stale socket
is removed only after a refused connection probe and inode recheck. Kernel locks
release on process death, allowing concurrent restart attempts to select one listener.

Runtime storage preflight verifies mount target, ext4, UUID, rw option, canonical
paths and device identity. It rejects existing and dangling symlinks, including
SQLite WAL/SHM paths. Writability is checked at the configured root or its nearest
existing parent, not at the filesystem's root: this Pi intentionally restricts the
mount top level while permitting the dedicated codex-work subtree. No mount is
created by preflight. Runtime state is only opened after this check passes.


## Authorized intake and schema 2 (Build 003)

`github.ts` owns the GitHub REST adapter through the existing `gh` credential store.
It validates returned shapes, accepts only same-endpoint GitHub next-page links,
passes argv/JSON without a shell, bounds each subprocess to 30 seconds/8 MiB, and
exposes redacted typed failures with rate-limit retry times. No token is returned.
Issue authorization uses the REST label event's actor, not author/body claims; see
[GitHub event semantics](https://docs.github.com/en/rest/using-the-rest-api/issue-event-types).

`intake-policy.ts` hashes title/body and extracts the four required contract sections;
fenced text and conflicting duplicate headings cannot supply a valid contract.
`intake.ts` re-fetches each discovered issue and all bounded event pages, maintains
independent project polling, and rechecks existing work regardless of discovery labels.
Discovery checkpoints advance only after page items are durable; a full scan repeats
after the last page to tolerate pagination movement/eventual consistency. Five discovery
pages per repository/round and 100 event/comment pages per read bound work; excess
or cyclic evidence pages block rather than infer authorization.

Schema 2 migrates schema 1 atomically, retaining existing jobs/events/operator settings.
It adds project retry state, acknowledgment intents and a durable contract-invalid flag.
The latter survives scheduler blocker changes: lease-bound operations and retries
cannot bypass contract reconciliation. Jobs begin blocked until acknowledgment is
confirmed, or remain requirements-blocked. The random marker, exact body and sender
are persisted before POST; a compare-and-set allows only one sender. A crash/lost
response after send requires comment reconciliation. Absence of a matching comment
never causes an automatic second POST. Explicit generations and their operator reason
are inserted in one transaction; toggling labels never creates a generation.

Intake cancellation/interrupt does not clear task/turn identity, lease or remote-operation
reservations. Execution and recovery must reconcile authoritative remote state before
releasing them. Every execution/publication boundary must invoke `Intake.authorize`
for fresh authorization in addition to durable worker fencing. The Build 003 live
fixture verifies GitHub/CLI intake only; complete agent execution and recovery remain
later gates, and no production intake service is activated.

## Isolated implementation and publication (Build 004)

`Worktrees` owns bare clones and deterministic per-generation branches under the
validated external storage root. Persist the fetched main SHA before creating the
worktree; retries verify identity and preserve existing edits. Output checks reject
out-of-scope files, symlinks and submodules. An operator-configured Git author is
written only to owned clones, never inferred from a developer checkout.

`ExecutionAgent` persists a random threadSource before task creation and a random
clientUserMessageId before turn creation. Lost responses reconcile exact identity
through bounded complete history; missing/ambiguous results block. A newly created
empty task must not be resumed before its first turn. Received turn IDs are recorded
even if cancellation raced the response. Only authoritative idle state plus the
recorded terminal turn releases the turn reservation. Approval events/flags remain
visible; the worker never approves requests itself.

`Implementation` persists one absolute deadline across retries. It checks local
fencing on each observation, remote issue authorization at the configured polling
cadence and freshly before execution/publication boundaries. Commands have durable
intents and private artifacts. The verification subprocess has bounded time/output,
a minimal filesystem, no host credentials and no network; trusted setup is explicitly
network-enabled. Process/PID namespaces and abort handling stop descendants.

`Publication` reconciles commits by parent/tree/message and pushes only an expected
branch using normal fast-forward rules. Configured verification must match the exact
head and argv. A changed remote base, dirty tree or unknown branch head blocks.
Fresh authorization precedes each push and PR POST. Exact body/random-marker matching
reconciles one draft PR; absence after an ambiguous POST never authorizes a repeat.
The completed implementation releases its lease at pr-open, not ready-for-human.
Operator publication continuation requires authoritative completed-task proof and a
fresh authorization guard before reacquiring a fenced lease; it preserves budgets
and unresolved intents. Generic recovery and unattended operation remain Build 007.


## Independent code review (Build 005)

`ReviewInputs` collects ordered commits and the aggregate diff from the owned worktree,
validating the open PR's exact head/base/branch before and after collection. Oversized
input blocks rather than silently truncating review coverage. `CodeReviewRound` owns
structured reviewer output, distinct task identity, original deadlines and attributed
publication. `Reviews` stores immutable head bindings, reports, dispositions and
persistent correction charges; a changed head/base invalidates prior sign-off even if
a former SHA returns later.

`ReviewCoordinator` assesses each finding on the original implementation task, publishes
accepted contracts or rejection/deferral reasons, then verifies scoped corrections and
obtains revalidation from the same independent reviewer. A blocking disagreement or
unavailable evidence remains visible. `PrComments` reconciles random marker, exact body
and authenticated author before considering a send complete; ambiguous absence never
repeats a POST. Read-only task observations have bounded retries; side-effect sends do
not. Explicit continuation proves the last recorded turn completed before reclaiming
a blocked job, retaining original identities, operations and elapsed budgets.

Sign-off with nonempty limitations cannot enter E2E. A bounded clarification turn may
ask the same reviewer to correct inconsistent report semantics; it cannot delete gaps
or substitute a coordinator-authored verdict. The original report and clarification
intent remain durable. Build 006 supplies E2E execution and readiness; full operational recovery remains a subsequent gate.


## E2E and readiness (Build 006)

Review evidence is partitioned by role but shares immutable target bindings and a
persistent correction budget. E2E requires a third task, the exact acceptance text
and observed success/failure workflows; unit tests or source inspection alone cannot
satisfy its contract. Its corrections transition through verification and code review
before the original E2E task can revalidate. Code review may retain the current lease
for this handoff, keeping the global single-job/turn fence intact.

Readiness is a dedicated atomic completion operation; generic stage transitions
cannot bypass its checks. `readinessEvidence` validates independent reports, original
execution deadline, current configured command evidence, fresh PR/check state and
notification delivery. The GitHub reader checks the owned head/base, actual base
branch, mergeability, complete bounded check/status pages and protected-branch classic
and ruleset requirements. Pinned check app identities must match. Missing/unavailable,
stale, ambiguous, pending or failed evidence blocks; it does not count as a pass.

The notification stores a stable owner-attributed message and outbox identity for the
head/base, then uses exact-body/author reconciliation through `PrComments`. A fresh
remote read follows the send before local `ready` is recorded. Later explicit rechecks
can revoke readiness while retaining reports and notification history. Restoring an
unchanged target reuses completed reviews and the same notification; changed targets
need fresh reviews. The public message is a timestamped verified snapshot, not a claim
of continuing validity or email/push delivery. Generated PRs remain drafts and no
merge/deploy API is implemented. Service scheduling of rechecks and general recovery
of unknown side-effect intents remain Build 007 responsibilities.
