# Prime Mover execution log

## Authority and current state

This is the source of truth for actual execution and release-note generation, backed
by Git and linked verification/review evidence. Plans are not accomplishments.
Application milestone: **Minimum Viable Application**. Status: **in progress**.
Builds 001–002: **complete** (contracts, durable scheduler/store, operator controls and metadata).
Builds 003–008: **pending**. Intake, implementation/review coordination and notification
delivery are not implemented or activated yet. See the Build 001 evidence below.

## Entry contract

Append an entry for each build, review fix, blocker, and release-note action. Preserve
failed outcomes; append corrections rather than rewriting history to appear successful.
Update the current-state summary when supported by new entries.

Each implementation entry must include:

- Build ID, scope, branch/PR, actor, environment, and status.
- Acceptance criteria addressed and explicit outstanding criteria.
- Red evidence: exact command, exit code, relevant failing assertion, expected cause.
- Green evidence: same command, exit code, passing results, and regression checks.
- Durable redacted evidence or PR attachment links, not only ignored local paths.
- Decisions, deviations, failures, blockers, limitations, and next action.
- Commit provenance: `Build: NNN` trailer identifies the primary commit. A commit cannot
  contain its own SHA; resolve with `git log --format='%H %s%n%b'` and record its SHA
  in the PR or a later natural entry. Fixes use `Fixes-Build: NNN`.
- Review entries additionally record reviewer role/task, exact reviewed SHA, report URL,
  finding disposition, acceptance/verification contract for fixes, and result.

Do not record credentials or private transcripts. Unknown, blocked, and not run are
valid statuses; do not present them as passed. Release notes summarize only verified
entries and disclose known limitations. Final-head sign-offs are authoritative on the
PR; no self-referential SHA or endless sign-off-only commits are required.

## Harness preparation

Scope: repository workflow instructions, eight build contracts, reviewer roles, and
execution/release-note evidence conventions. Application execution is not authorized
by completion of this preparation task alone and has not started.

Verification contract: parse both role files as TOML; resolve local documentation
links; confirm eight sequential contracts with acceptance, red/green, and exit gates;
walk through a successful build, a failed-red blocker, code/E2E findings, a late code
change, and the post-review release-note commit; run `git diff --check`.
No artificial red/green application test is appropriate for documentation-only setup.
Results and review evidence will be appended after these checks actually run.

### Preparation verification results

Environment: existing Pi checkout; Python 3 TOML parser; Codex CLI 0.155.0.
Branch: `chore/mva-execution-harness`. Application builds remain pending.

- Python `tomllib.loads` parsed both `.codex/agents/*.toml`; required name,
  description and developer_instructions fields were present and names matched files.
- Python path/link inspection found eight sequential build contracts (001–008),
  each with acceptance, red-first, green/regression and commit/exit sections.
  All relative Markdown links resolved. All assertions passed; exit 0.
- `git diff --check`: exit 0, no whitespace errors.
- Workflow walkthrough: successful build records meaningful red then green in one
  commit; environment-only failure blocks instead of counting as red; code findings
  return to code review; E2E fixes return through code review; late changes invalidate
  sign-offs; release notes follow review and receive both final-head revalidations.
- These are documentation/configuration checks, not application E2E results or proof
  of automatic runtime role discovery. Fresh reviewer tasks will use the role files.
- Review status: pending independent code and documentation-workflow E2E review.

### Preparation review completion and release-note authorization

PR: https://github.com/talaniz/prime-mover/pull/1
Reviewed preparation head: `e6789adad253e0d36fe67864ff47b7f7befda5b7`.
All eight planning commits were inspected individually and as a combined diff.
`git rev-list --reverse origin/main..HEAD` plus per-commit `git diff-tree` verified
one sequential contract per commit. `git check-ignore harness/build/probe.log`
confirmed ignored output; `git ls-files harness/build/README.md` confirmed tracked
instructions. `git diff origin/main...HEAD --check` passed, exit 0.

- Code reviewer `/root/code_review`: SIGN-OFF, no actionable blockers.
  Report: https://github.com/talaniz/prime-mover/pull/1#issuecomment-5745945327
- Distinct E2E reviewer `/root/e2e_review`: documentation-workflow SIGN-OFF, no blockers.
  Report: https://github.com/talaniz/prime-mover/pull/1#issuecomment-5745954181
  Exercised successful build flow, invalid-red blocker, code findings, E2E fixes,
  changed heads, post-review notes, and notification/merge boundaries.
- Both independently verified role TOML, paths, commit mappings and scratch rules.
  The active tool lacked named-role selection; each fresh reviewer task read and
  adopted its role file's instructions. Automatic named-role discovery was not tested.
- No findings required a fix cycle. Main task verified report contents and matching
  head, confirms no blockers, and signs off on the preparation scope for note generation.
- This log supports `release-notes/harness-preparation.md`. This is documentation
  readiness only, not an MVA release, application test pass, merge or deployment.
- Next gate: commit notes and this entry, then obtain both final-head revalidations
  on the PR before marking ready and notifying the user. The final PR comments are
  authoritative for that gate; no additional log-only commit is needed.

Application milestone status remains **not started**; builds 001–008 remain **pending**.

### MVA planning amendment: two projects and dashboard metadata

User direction: track Prime Mover itself and the existing DOOM Dashboard by default;
include a read-only Projects page in the existing dashboard in the first milestone.
Verified checkout origins: talaniz/prime-mover and talaniz/doom-control; both remote
HEADs resolve to main. The original Prime Mover checkout remains clean on main;
planning edits use a separate worktree/branch. DOOM source and service are untouched.

Acceptance: two explicit defaults, per-project authorization/configuration and
identity, one global job/turn, read-only metadata with honest freshness/error states,
secure authenticated dashboard consumption, and explicit cross-repository delivery.
Verification contract: inspect identities and remote HEADs; check Markdown links,
role TOML and whitespace; walk through defaults, unauthorized intake, duplicate issue
numbers, contention, metadata states and dashboard integration dependency. No runtime
test pass is claimed for documentation-only work. Review evidence follows on the PR.

Scope is planning only: project-metadata.md and builds 001/002/003/004/008 carry the
amendment. All application builds remain pending. The existing one-Prime-Mover-PR
rule remains; the dashboard needs a linked integration PR in its own repository.

Planning verification results: remote-origin/HEAD probes verified both identities and
main branches; Python Markdown-link checks and role TOML parsing passed; all eight
build contracts remain present; git diff --check passed. Operator walkthroughs of
the seven metadata scenarios identify explicit expected outcomes and required future
evidence. The Drive plan was edited in place to match the defaults, Projects page,
build ownership, cross-repository delivery and new MVA-8 criterion. No application
code/tests were run or claimed complete. Named-role selection is unavailable here;
fresh independent reviewers receive the checked-in role instructions as fallback.

### Planning amendment reviews and release notes

PR: https://github.com/talaniz/prime-mover/pull/2
Reviewed planning SHA: `61ccf4686841300c45e85727c53c2322728774c3`.
Independent code reviewer /root/code_review signed off with no actionable findings:
https://github.com/talaniz/prime-mover/pull/2#issuecomment-5752329631
Distinct documentation-workflow E2E reviewer /root/e2e_review signed off after all
seven operator scenarios, build ownership and cross-repository/failure walkthroughs:
https://github.com/talaniz/prime-mover/pull/2#issuecomment-5752340364
Both reviewers independently checked documentation links, role TOML and whitespace;
E2E also checked local identities and the original clean main checkout. Main task
verified both reports and matching SHAs; no blockers remain in the planning scope.
Drive readback confirmed one tab, 13 heading sections and ordered MVA-7/MVA-8 with the
new requirements present and obsolete single-repository wording removed.

Generated release-notes/default-projects-metadata-plan.md from this evidence. Both
reviewers must revalidate the notes commit on GitHub before readiness. No application
or browser test results are claimed. Application builds remain pending; no merge,
deployment or live DOOM change occurred. PR reports no automated status checks.

## Build 001 execution contract (in progress)

Milestone branch: feat/mva-workflow-engine, based on origin/main fe3352b.
User authorized transferring the existing engineering-priorities AGENTS.md addition
onto this branch; it is preserved. Main was fast-forwarded before branching.

Acceptance/verification: typed validation rejects malformed project identities,
unsafe/non-absolute storage paths, missing command contracts/maintainers, duplicate
projects and unsafe concurrency; defaults contain both projects. Preflight rejects
missing GitHub/app-server credentials or unsupported installed protocol. Transport
contract tests use an actual local WebSocket server and recorded installed protocol
shapes for initialize, requests, approvals, disconnects, timeouts and recovery reads.
Use npm test for config/state classification, npm run test:integration for transport
and real SQLite, npm run test:e2e for a spawned operator diagnostic, npm run check for
all offline checks. A separate explicit live probe must complete a harmless isolated
app-server turn and reconnect/read/resume it, and GitHub probes must identify both
repositories and authorized maintainer. Never treat mocks as live acceptance.

Initial environment: Node 22.23.2, npm 10.9.8, Codex CLI 0.155.1, ARM Pi; built-in
node:sqlite opens successfully with SQLite 3.51.3 (experimental API warning retained).
External ext4 is mounted read/write. GitHub reports push/admin permission for both
configured repositories. No runtime worker or intake has been activated.

### Build 001 results and exit gate

Scope delivered: locked Node/TypeScript/ws toolchain, typed configuration validator,
two-project config example, adapter/metadata types, tested app-server transport,
configuration CLI, issue/PR templates and architecture/credential documentation.
AGENTS engineering priorities are included as explicitly authorized by the owner.

Red evidence (all executed before the corresponding implementation):
- `npm test`, config skeleton: exit 1; 1 passed / 19 failed. Invalid path, duplicate
  identity, unsafe concurrency and missing credentials/protocol checks failed with
  missing expected exceptions; this was missing behavior, not a broken environment.
- `npm test`, protocol skeleton: exit 1; 20 passed / 2 failed (sandbox/approval options
  absent, active/unknown task state incorrectly classified idle).
- `npm run test:integration`, transport skeleton: exit 1; 0 passed / 5 failed
  (missing RPC result, error/timeout/disconnect rejection and approval event).
- `npm run test:e2e`, CLI skeleton: exit 1; 0 passed / 3 failed (no JSON output,
  invalid configuration and unknown commands incorrectly exited successfully).
- `npm test`, malformed preflight inputs: exit 1; 22 passed / 2 failed (missing
  credential fields accepted and missing method list raised an unhelpful TypeError).

Green: `npm run check` passes strict TypeScript build/lint, 24 unit tests, 6 actual
Unix-WebSocket/SQLite integration tests and 3 spawned CLI E2E tests, no skips. The
first scaffold check had zero E2E tests; it was not accepted as CLI evidence and was
replaced by the failing then passing operator scenarios above. SQLite WAL transaction
visibility, rollback, reopen and integrity were observed with the real driver.
Refactor assessment: keep small config, transport, CLI and types modules; no further
behavior-preserving refactor needed. Documentation links, role TOML and whitespace pass.

Live app-server acceptance (existing daemon, isolated external-volume probe directory):
- `node scripts/probe-app-server.mjs SOCKET ISOLATED_CWD EVIDENCE_JSON` completed the
  harmless PRIME_MOVER_PROBE_OK turn, reconnected/read history/resumed the same task.
- Task: 01a0c08c-b669-72f0-bc3d-26b964bd4f1a.
  Successful turn: 01a0c08c-b6d4-7521-93d9-0011ea51a60a.
- Resume response verified approvalPolicy=on-request, approvalsReviewer=auto_review,
  sandbox.type=workspaceWrite; idle state observed. Approval requests are tested as
  visible waits in the transport fixture; no real privileged approval was requested.
- A second harmless counting turn 01a0c091-ba06-7700-af9e-b4ab03adc421 exercised
  interruption. Immediate turn/interrupt returned RPC -32600. We did not infer it
  stopped: thread/read and thread/turns/list confirmed active/inProgress. Reconnecting,
  thread/resume, then turn/interrupt for that same ID succeeded; thread/turns/list
  confirmed interrupted. No replacement task/turn was started after the rejection.
  Keep this race/reattachment case in subsequent recovery tests.
- Installed generated 0.155.1 types confirm lifecycle/history/interrupt methods and
  approval flags. Full history for a job must paginate in later coordinator builds.

GitHub read-only acceptance: `gh api user` identifies talaniz; repository APIs report
push/admin access to talaniz/prime-mover and talaniz/doom-control, both default main.
Collaborator permission endpoints independently return admin for talaniz on both.
Label listing works; codex-ready does not yet exist and must be provisioned explicitly
for supervised intake fixtures before Build 003 live verification. No issues were run.

Limitations: CLI E2E is configuration-only, not complete worker/dashboard acceptance.
Metadata API/registry implementation is Build 002 and DOOM integration is required by
Build 008. UUID example is a placeholder until real mount preflight is configured.
No claim of persistent mounting, service deployment, production activation, automated
reviews or MVA completion. Next: Build 002 real transactional store, global scheduler
limits, operator controls and read-only metadata. One milestone PR will hold all builds.

## Build 002 execution contract (in progress)

Continue feat/mva-workflow-engine and milestone PR #3 from Build 001 9e56b53.
Acceptance: real SQLite migrations preserve registry/jobs/events/attempts/outbox;
project defaults seed idempotently without changing operator settings. Transactional
claims enforce one global job/turn across projects and processes. Leases fence every
worker mutation; expiry never implies remote termination. Operator pause/resume,
status/inspect, cancellation and reasoned blocked-job retry persist across restart.
External-operation intents must survive a crash and block unsafe automatic retry.
Read-only authenticated Unix-socket metadata must be redacted, timestamped and honest
about empty/paused/blocked/stale states. Verify the expected external mount before
opening runtime SQLite; do not create fallback state when the mount is absent.

Verification: tests-first real-store assertions, two independent Node processes
contending for different queued projects, fake-clock lease/deadline tests, killed
worker/reopen with fake external adapter and retained intent, spawned CLI workflows,
actual HTTP-over-Unix auth/read-only/redaction checks. Tests use isolated temporary
SQLite files; real CLI acceptance uses a disposable subtree on the verified external
ext4 UUID c6d768c3-187e-43b0-b14e-cb6c659d06f7. No production service activation.

### Build 002 results and exit gate

Implemented schema v1 migration and reopen, preserved project settings, repository-
scoped generations, atomic global lease/turn claims, fencing, append-only events,
attempts/budget counters, persisted retry deadlines, operation/notification intents,
cooperative scheduler cancellation, operator CLI, storage preflight and read-only
HTTP-over-Unix metadata. Metadata uses one read transaction and fixed safe blocker
messages; source poll age is distinct from snapshot age. No production worker enabled.

Red evidence:
- `node --test test/integration/store.test.mjs` against behavioral placeholders:
  exit 1, 0/11 passing; persistence/idempotence/claims/lease/state checks failed.
- Metadata HTTP/projection placeholders: exit 1, 0/2 passing (missing fields and
  unauthenticated request incorrectly returned 200).
- Storage placeholder: exit 1, 0/1 passing; absent mount was wrongly accepted.
  Doctor CLI cycle: exit 1, 3/4 passing; doctor was not yet an implemented command.
- Store+Scheduler retry/outbox/cancellation additions: exit 1, 11/17 passing;
  deadlines, counters, notification intents and cancellation were unimplemented.
- Boundary regression cycle: exit 1, 16/19 passing; pending notifications did not
  reserve execution, cancellation allowed new intents and dangling symlinks passed.
  Corrected all three before the full green check.

Corrections honestly recorded: the first store green attempt passed 10/11; the last
failure was case-sensitive matching of the turn-identity diagnostic, corrected to a
clear active-turn message. The first live operator rehearsal failed preflight because
this account cannot write the mount top level, although codex-work is writable.
Retained UUID/device/rw/symlink checks and verified writability at the configured root
or nearest existing parent; the same live rehearsal then passed. No guard was disabled.

Green evidence: npm run check passes 26 unit, 29 integration and 4 spawned CLI tests
(no skips); final post-format/check results are recorded on PR #3. Two separate Node
processes raced for two project jobs and only one received a lease. A fixture worker
was SIGKILLed with a pending external intent; reopen preserved pause, attempts,
ownership and intent, and did not start replacement work. Fake-clock tests proved
lease fencing and no early retry. Actual Unix HTTP tests checked unauthorized 401,
unknown-project 404, mutation 405, redaction, timestamps and no writes from reads.

Live command: node scripts/rehearse-operator.mjs /media/talaniz/postgresdata
c6d768c3-187e-43b0-b14e-cb6c659d06f7. Exit 0; doctor, status, persistent pause/resume,
queued cancellation, reasoned blocked retry and redacted inspect all passed.
Foreground metadata returned both defaults to authenticated reads and rejected bad
auth; socket mode was 0600. Wrong UUID failed without creating the configured root.
Disposable subtree, token and server were cleaned up; productionChanged=false.

Refactor: formatted the new store/metadata/storage/scheduler and CLI modules using
Prettier 3.6.2 without changing package dependencies; rerun all checks after formatting.
The database module owns transactions; public projection, filesystem preflight and
scheduler responsibilities remain separate. Build 001's compatibility evidence remains
applicable; no unrelated live agent turn was rerun.

Limitations: automated reconciliation of expired leases/ambiguous remote results is
Build 007; current behavior explicitly reserves/blocks them. No GitHub issue intake,
production service, app implementation pipeline, automated reviewer or DOOM page exists
yet. The scheduler is exercised with fake external adapters. Next gate: Build 003
maintainer-authorized two-repository polling with lifecycle/revocation and fixture evidence.

## Build 003 execution contract (in progress)

Continue the same milestone branch/PR from Build 002 b5c5eb4. Implement authenticated
GitHub issue/events/comment pagination behind an adapter, explicit allowlisted
maintainer label provenance, required objective/scope/acceptance/verification sections,
repository-scoped deduplication and durable acknowledgment reconciliation. Poll both
projects fairly with per-project checkpoints, bounded pages/attempts and persisted
backoff. Reconcile accepted issues for closure, label withdrawal and material edits
before scheduling/publication; interrupt only owned active turns where supported.
Missing requirements must be visibly blocked with a specific clarification request,
not guessed. Operator contract reconciliation is explicit and auditable.

Verification: tests-first policy cases; controlled GitHub adapters exercising duplicate
pages, same-number issues, absent actor, unauthorized relabel, missing sections,
403/429/outages, acknowledgment response loss and restart, checkpoint safety and
lifecycle changes. Use actual SQLite and an isolated HTTP fixture for transport.
Live acceptance will designate a new private talaniz/prime-mover-fixture repository,
with a harmless issue and codex-ready label; never enable intake against production
issues merely to demonstrate the defaults. Preserve the execution log with each commit.

## Build 003 completed — authorized GitHub intake

Implemented the GitHub REST adapter through the existing `gh` credential store,
validated pagination and typed/redacted failures; explicit maintainer label-event
policy and content-hashed contracts; schema-2 polling/acknowledgment state; independent
project intake with durable checkpoints/backoff; lifecycle monitoring and worker
fencing; explicit contract reconciliation and audited rerun generations. CLI now has
`poll`, `reconcile-issue`, and `rerun`; public metadata has actionable intake blockers.
Each repository's discovery slice is bounded, and concurrent repository polling
prevents a slow repository from delaying the other. No execution task is started by
intake. The two default production project entries remain unchanged.

Test-first evidence (Node 22.23.2, npm 10.9.8, native SQLite on this Pi):

- `npm run build` exited 0 with behavioral stubs before tests. Policy tests exited 1:
  9 failed/1 passed, including expected authorized=true versus false and a missing
  content hash. GitHub adapter tests exited 1 with 9 assertion failures, including
  missing next-page mapping and missing HTTP failure rejection.
- Initial intake tests exited 1 (11 failed/1 passed); primary behavioral assertions
  found zero jobs where two independently authorized repository jobs were required,
  and no persistent blocked job for incomplete requirements. The same cases passed
  after implementation. Raw scratch evidence: `003-policy-red.txt`,
  `003-github-red.txt`, `003-intake-red.txt` under ignored `harness/build/`.
- Additional edge tests first failed for contract-invalid waiting transitions and
  reruns bypassing intake pause (2 failures), slow-repository starvation (1 failure),
  and operator reconciliation requeueing an unchanged job (1 failure). Fixed with
  durable invalidation fencing, paused-rerun rejection, independent repository
  polling, and reconciliation restricted to changed/incomplete blocked contracts.
- Controlled tests cover duplicate pages/events/polls, same issue number across both
  repositories, unauthorized/missing actors, misleading issue text, fenced/duplicate
  contract headings, 401/403/429/outages, persistent retry delay, page interruption,
  active-turn cancellation/owned interrupt identity, closure/relabel, explicit rerun,
  contract edits, ambiguous POST responses and forged acknowledgment comments.
  Unconfirmed sends are never automatically repeated. A real local HTTP fixture
  exercises event/comment pagination, POST JSON and rate-limit handling through the
  adapter; actual `gh` transport is separately verified by the live fixture below.
- Schema-1 upgrade preserves existing job snapshots/events and operator pause.
  A full regression run exposed a preexisting nondeterministic notification test:
  it retried the first enqueued ID instead of the ID actually claimed when enqueue
  timestamps tied. Corrected the test to use `lease.jobId`; production fairness
  behavior was not changed to accommodate the test.

Live acceptance used private `talaniz/prime-mover-fixture`, isolated external-volume
state, and actual CLI invocations (including process reopen on every poll). The first
attempt on issue #1 expected immediate label discovery and observed no job; subsequent
read-only inspection found the issue and valid maintainer event. This was consistent
with GitHub list propagation delay, not an authorization-policy rejection. Closed and
unlabelled #1 with zero comments, preserved failed evidence, and added bounded live
polling plus a later-full-scan test. Never counted that first attempt as a pass.

The successful rehearsal ran 2026-09-20 21:33:59–21:34:56 UTC:

- [Fixture #2](https://github.com/talaniz/prime-mover-fixture/issues/2): label event
  `31493519274`, authenticated actor `talaniz`; generation-0 job
  `38c06187-6dfd-4330-8518-eb0c1fbcd377`; acknowledgment
  [5752821060](https://github.com/talaniz/prime-mover-fixture/issues/2#issuecomment-5752821060).
  Repeated process/poll runs retained exactly one job/ack. Title edit blocked work;
  explicit `reconcile-issue` accepted the revised contract. Label withdrawal cancelled
  the job; relabelling did not rerun it.
- Explicit `rerun` created generation 1, job
  `041147b3-d43b-411e-8451-8c454a06a2d1`, with operator reason and a separate
  [generation acknowledgment](https://github.com/talaniz/prime-mover-fixture/issues/2#issuecomment-5752822823).
  Closing the issue cancelled this generation. Two comments here are expected for
  two explicitly authorized generations, not a duplicate-send result.
- [Fixture #3](https://github.com/talaniz/prime-mover-fixture/issues/3) had incomplete
  requirements, remained blocked and received one specific
  [clarification acknowledgment](https://github.com/talaniz/prime-mover-fixture/issues/3#issuecomment-5752824386).
  Closing/unlabelling it cancelled the job. Final read-only verification: issues
  #1/#2/#3 closed, no labels; comment counts 0/2/1, all authored by `talaniz`.
- The script exited 0; all fixture jobs terminal, no active thread/turn IDs and no
  execution task started. Retained ignored evidence: `harness/build/003-live-intake.json`;
  isolated root `/media/talaniz/postgresdata/codex-work/intake-rehearsal-lygbMC`.
  This did not activate production intake, alter live DOOM, merge or deploy.

Design boundaries: acknowledgment absence after an ambiguous send remains blocked;
only a matching exact body/marker and sender confirms delivery. Operator recovery for
unresolved remote ambiguity remains Build 007. Fresh authorization guards are ready
for Build 004 to invoke before every execution/publication boundary. The complete
agent pipeline, automated reviews, DOOM Projects view and MVA release gates remain
pending; independent milestone reviews run after implementation is complete.

Final Build 003 verification: `npm run check` exited 0 after the final implementation
and formatting: **47 unit + 51 integration + 4 CLI E2E = 102 passed**, zero failed or
skipped. Includes the unchanged-job reconciliation guard, schema upgrade and HTTP
fixture. `git diff --check` exited 0. Raw final output is ignored
`harness/build/003-final-check.txt`. The native SQLite experimental warning remains
visible; runtime/version restrictions from Builds 001–002 are unchanged.

## Build 004 execution contract (in progress)

Continue the milestone branch from Build 003 `095b1da`. Build 004 must prepare
worker-owned repository clones/worktrees at a durable base SHA; execute a bounded
implementation task via the existing app server; verify only configured argv commands
in an isolated environment; enforce configured output paths; commit/push and reconcile
one draft PR. Persist intentions before branch/task/turn/push/PR side effects and
reconcile observable state rather than blindly repeat ambiguous writes. Approval,
failed/no-op output and unknown remote state remain explicit blockers. Neither live
DOOM nor a running worker checkout may be changed/reloaded.

Concrete verification begins with real local Git fixture repositories for both project
identities: pinned base, deterministic branches, repeat/crash recovery, path escape,
symlink/submodule/output-scope rejection and literal argv. Then test app-server events,
turn history, approval/timeout/abort and crash windows, plus verification and PR gates.
Use real local subprocess/WebSocket/HTTP boundaries where useful; mocks cannot replace
the mandatory small live GitHub fixture implementation and generated PR. Live evidence
must retain task/turn IDs, base/head SHAs, commands/results and PR URL. One primary
Build 004 commit only after the complete exit gate; no partial-build commit.

A read-only capability probe confirmed `/usr/bin/bwrap` can run a minimal filesystem/
network-isolated `/usr/bin/true` on this Pi (exit 0). This supports a verification
runner that excludes host credential directories rather than directly running changed
repository scripts with unrestricted host access. This probe is environment evidence,
not a substitute for meaningful behavior-test red evidence.

### Build 004 foundation progress — not the build exit gate

Added `Worktrees` and `runIsolated` with real Git/subprocess tests. The worktree
manager uses worker-owned bare repositories and isolated directories, records a base
SHA in its returned plan, derives branch names from validated project/issue/generation
identities and preserves existing edits when reconciling branch/worktree creation.
It checks common-repository/branch identity, base ancestry, allowed output paths,
symlinks and no-op output. The coordinator must persist the returned plan and reuse
it on restart; durable orchestration is not implemented by these primitives alone.

The verification runner uses bubblewrap with a minimal read-only runtime, a writable
worktree, private temporary/home directories, cleared credential environment and no
network by default. Trusted setup can explicitly enable network without mounting
host credentials. Commands use literal argv, bounded time/output, process-group/PID
namespace cleanup and abort handling. Git metadata can be mounted read-only when
needed. Tests verify real stdout/exit codes, hidden host homes/environment/secrets,
blocked access to a host listener, timeout, output limits and pre-/mid-run abort.

Observed red/green evidence:
- `npm run build` exited 0 with the worktree stub, then real-Git tests exited 1 with
  five failures (missing base SHA/branch, missing escape rejection). Implemented the
  manager. An initial syntax error was caught by TypeScript; emitted JS tests alone
  were not counted as a green build. Corrected it, rebuilt successfully, and the five
  original cases passed. Added project-attribution/branch-tampering coverage: six
  real-Git cases now pass, including both default project identities.
- Verification stub built successfully, then four tests failed on missing actual
  output, incorrectly passed exit/abort results and missing isolation evidence.
  Implemented the runner; all four passed, then added network/output/mid-run abort
  checks. A full run failed because the output fixture loop called asynchronous
  stdout writes without yielding, so it timed out before flushing enough bytes.
  Changed the fixture to synchronous writes; retained the output-limit assertion.
  All six verification cases pass. No timeout was relabelled as output-limit success.
- Actual configured command `npm run check`, launched through `runIsolated` with a
  120-second limit, exited 0 in ~45 seconds (2026-09-20 21:54:25–21:55:10 UTC):
  **47 unit + 63 integration + 4 CLI E2E = 114 passed**, no failures/skips. This also
  proves the full test command and nested bubblewrap/Git fixtures work in the runner.
  Scratch evidence: `harness/build/004-isolated-repo-check.txt`; initial red and
  narrow green logs use `004-worktree-*` and `004-verification-*`. The failed initial
  broad run remains `004-foundation-check.txt`. `git diff --check` exited 0.

Installed 0.155.1 generated protocol was inspected for upcoming task orchestration:
`thread/list` supports exact cwd and pagination; `turn/start` has
`clientUserMessageId`, and full turn history includes userMessage.clientId. Use
persisted correlation and authoritative history, not speculative transport retries.

Build 004 remains **in progress**, with these changes intentionally uncommitted until
its single-primary-commit gate is complete. Next: durable task/turn execution and
approval/timeout/crash behavior, commit/push/PR reconciliation, and a real small
fixture issue through implementation/checks/one PR. No new app-server task or GitHub
fixture issue was created by these foundation tests, and no live checkout/service
was changed. Builds 005–008 and independent milestone reviews remain outstanding.

### Build 004 orchestration, live acceptance and completion

Implemented durable app-server execution, configured verification, coherent commit/
fast-forward push and exact-marker draft PR reconciliation. The worker records task
and turn correlation before sends, paginates authoritative history, verifies ownership,
and retains active/uncertain reservations. Approval requests remain waiting; failed,
no-op, timed-out and unverified output cannot publish. `run-once` claims one already
queued job. `resume-publication` is an explicit operator continuation only after
completed owned-task proof and fresh issue authorization; original intents and the
absolute job deadline survive continuation. General recovery remains Build 007.

Additional red/green cycles observed during this build:
- Initial execution-adapter tests exposed missing start/observe behavior; subsequent
  cases reproduced cancellation racing an accepted turn, mismatched approval request
  resolution, and a stale turn being mistaken for the currently reserved turn.
  Fixes preserve exact ownership and terminal-state reconciliation. Lost task/turn
  responses never cause replacement sends; ambiguous absence remains blocked.
- Initial publication tests exposed missing commit/push/PR behavior. Real local Git
  cases now verify coherent commit recovery, lost push acceptance, lost PR response,
  no duplicate POST, current-head verification, dirty output and changed base guards.
  The first advanced-base fixture used update-ref without transferring its object;
  corrected the fixture to push the object before asserting the guard. That setup
  error was not counted as product red evidence.
- Five orchestration tests first failed with missing worker behavior, then passed
  against real Git and sandboxed commands: success, failed implementation, no-op,
  failed verification and unresolved approval. Approval wait must not be mistaken
  for withdrawn issue authorization; intake regression coverage now confirms this.
- Live execution exposed premature resume of a new empty task. A regression test
  failed against that behavior; creation now uses its validated response directly.
  Recorded tasks still reconcile through resume/history. The adapter/publication
  follow-up suite passed 19 tests after this fix.
- A fresh bare clone had no Git author, unlike the developer checkout. Author/config
  tests failed before adding explicit optional configuration and owned-clone setup;
  30 config/worktree checks then passed. Execution requires gitAuthor; older read-only
  configs still validate. No global Git identity was changed.
- Operator continuation was added test-first: reclaim after completed execution
  preserves pending publication intents, requires an audited reason and rejects
  conflicting reservations. Remote proof rejects active/failed turns without a new
  turn/start. The execution/implementation/scheduler follow-up passed 20 tests, then
  the additional authoritative-completion rejection case passed.
- Final boundary tests reproduced two missing rejections when authorization was
  withdrawn immediately before push or PR POST, plus 25 GitHub guard calls during
  20 rapid task observations. The initial suite had 12 passes/3 failures. Publication
  now refreshes authorization before each external mutation, before recording a new
  send intent; active monitoring respects pollSeconds while local fencing stays
  per-observation. The same 15-test suite then passed. Refactor review retained the
  existing adapters and durable operations; no extra abstraction was necessary.

Live fixture evidence (private owner-controlled repository, no production changes):
- Automatic approval review initially rejected the fixture launch because destination
  ownership was not established. Read-only GitHub evidence confirmed authenticated
  talaniz owns/administers the private acceptance repository; the specifically scoped
  retry was permitted. No enforcement control was bypassed.
- Attempt 1: issue #4, job `5d09c613-42c3-4a15-98ec-5d3c0c8594ea`, empty task
  `01a0c0e7-9d0c-7790-93e8-9ff324829064`. Premature resume failed before any turn
  intent. Authoritative reads/listing found no persisted/loaded task. With no active
  turn, pending send or publication, cancelled this fixture and closed/unlabelled its
  issue; retained first-attempt evidence. It was not counted as success.
- Attempt 2: [issue #5](https://github.com/talaniz/prime-mover-fixture/issues/5), job
  `ef3379c4-6639-4347-882e-f0aecf89bf4e`, task
  `01a0c0eb-997d-7851-81c1-50a697795654`, turn
  `01a0c0eb-9a3f-7bd0-9272-22c210f61de3`. Implementation completed, but commit
  initially failed for absent author identity (confirmed by Git author probe).
  Configured the fixture's existing milestone identity Codex <codex@localhost> and
  continued the preserved commit intent after authoritative completion proof. The
  continuation returned pr-open, exit 0, without another model task/turn or budget reset.
- Result: [draft PR #6](https://github.com/talaniz/prime-mover-fixture/pull/6), branch
  `prime-mover/fixture/issue-5-g0`, base
  `eee4090de3540b66a25e2ee9195ada3bbec68f00`, head
  `1d0e91dadf89888e0946e48c09dcd56783034d51`. One commit, exactly greeting.mjs and
  test/greeting.test.mjs. Configured `node --test test/greeting.test.mjs` passed,
  exit 0, with head-bound private artifact. Independent sandboxed assertions passed
  for normal/trimmed/internal-space input and TypeError for empty, whitespace, null,
  number and array input. Verified GitHub draft/open/base/head and released local
  lease/active turn at 2026-09-20 22:38:59 UTC. The issue/PR remain for later review
  acceptance, not ready to merge. No live DOOM checkout or running service changed.

Final Build 004 `npm run check` exited 0: **48 unit + 94 integration + 4 CLI E2E =
146 passed**, zero failed/skipped. `git diff --check` passed. CLI E2E remains the
configuration CLI suite; live implementation evidence above independently covers the
new worker flow. Ignored evidence includes `004-final-check.txt`, `004-boundary-red.txt`,
`004-boundary-green.txt`, and `004-live-implementation.json`; the latter retains the
original blocked attempt alongside successful continuation and final acceptance.
Node 22.23.2/SQLite experimental status and app-server 0.155.1 restrictions remain.

Build 004 exit gate is complete. This is its single primary implementation commit.
Builds 005–008, automated review/fix cycles, DOOM Projects integration, operations
acceptance and independent milestone reviews remain outstanding. No unattended worker,
merge, deployment or MVA completion is claimed.
