# Prime Mover execution log

## Authority and current state

This is the source of truth for actual execution and release-note generation, backed
by Git and linked verification/review evidence. Plans are not accomplishments.
Application milestone: **Minimum Viable Application**. Builds 001–008 are implemented
and verified. Independent product code and E2E reviews passed at Prime Mover
`de3c39f6bf8597ad7a468a49f44b5af7ad23e7f7` and DOOM
`4aacb601a8e158aa9310b8c62fd8a2c0464f70e7`, including paired-head integration.
Release notes are now recorded; final documentation-head revalidation and CI are the
remaining delivery gates, with authoritative final results on the product PRs.
Production activation, persistent boot mount and enforced memory limits remain
owner-gated. See the final review/release entry below and
[release notes](release-notes/mva.md). Historical entries retain their original status.

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

## Build 005 execution contract (in progress)

Continue from Build 004 `0e9f7508dcd00ed4acd0d0eacb918bd30e250565` on the same
milestone branch/PR. Implement separate owned code-review tasks, complete commit-list
and aggregate-diff input, structured reports, durable findings/dispositions and public
attributed comments. Accepted findings need concrete acceptance/verification before
fixes; rejected/deferred findings need public rationale and reviewer confirmation.
Every changed head invalidates prior sign-off. No E2E entry without current-head code
sign-off; missing checks/report evidence or disputed blockers cannot pass.

Start with real SQLite state and pure report validation: bind head/base/commit list,
reject implementer identity, stale or incomplete review coverage, missing report URLs,
missing actual checks and unresolved/disputed findings. Persist triage across reopen,
consume correction budgets without resetting on restart, and reject premature E2E
transitions. Then extend app-server role/report handling and GitHub comment delivery
with crash-response tests before a live independent fixture review/fix/revalidation.
The live gate must include a seeded defect and public exact-head reviewer evidence;
unit success alone cannot complete this build. One primary Build 005 commit only
after that entire gate. No partial-build commit or production service change.

### Build 005 foundation progress — not the build exit gate

Added a durable typed review ledger over existing fenced immutable operation records,
without a database schema migration. Operations now read in SQLite insertion order
rather than timestamp/key order, avoiding same-millisecond ordering ambiguity. Review
head bindings include the complete ordered commit list; reports are tied to a binding
revision so moving away and back cannot revive an old sign-off. Public report URLs,
owned reviewer task/turn identity, independent role, actual check descriptions and
absence of unresolved limitations/findings are required. The state machine now rejects
E2E entry before current-head code sign-off. Findings/dispositions persist across
reopen; accepted findings require acceptance/verification contracts, deferred/rejected
ones public rationale, and reviewer-confirmed resolutions/dispositions before sign-off.
Correction reservations retain a persistent bounded counter and idempotent per-cycle
intent. A crash between charging the budget and saving the reservation conservatively
over-counts an attempt; it never grants an unbudgeted correction or resets the budget.

`PrComments` publishes attributed coordinator comments, not formal GitHub approvals.
It checks current authorization before new sends, records a random marker/full body/
author, paginates existing comments and reconciles a lost response only by exact body
and author. Ambiguous absence, duplicate matches or a changed report stays blocked;
no blind repeat POST. `ExecutionAgent` now persists reviewer role and output schema,
uses independent-review instructions, rejects role/schema drift on replay, and reads
final report text only after completed owned-turn proof. Commentary/missing output
cannot substitute for a final report. Live use of these new review paths is pending.

Observed test-first evidence:
- Six initial ledger/state tests failed with missing required rejections; implemented
  current-head coverage/identity/triage checks and all six passed. Real SQLite reopen
  verified persistence. A seventh test then exposed revival after head B→C→B (missing
  expected exception); binding revisions fixed it. State/store/scheduler: 27 passed.
- An unrecorded reviewer task/turn was initially accepted (7 pass/1 fail); persisted
  ownership checks fixed it (8 passed). Further tests exposed an implementation role
  hidden under a review key and absent accepted-contract/correction-budget guards
  (8 pass/2 fail). Explicit review role plus persistent correction reservations fixed
  both. All ten ledger cases now pass, including repeat/reopen/exhaustion behavior.
- Four initial comment-delivery tests failed: missing canonical URL/durability and
  missing lost-response/withdrawal rejections. Implemented delivery/reconciliation;
  all four pass, including paginated lookup and wrong-author/absent-comment refusal.
- Three adapter tests failed on implementation instructions for a review role and
  missing terminal/missing-report rejection (14 pass/3 fail). Role/schema persistence
  and authoritative final-result extraction fixed them; all 17 adapter cases pass.
- Formatted the new modules/tests with the existing cached Prettier executable. The
  focused ledger/comment/adapter suite passed **31 tests**, exit 0. Full regression
  `npm run check` exited 0: **48 unit + 111 integration + 4 CLI E2E = 163 passed**,
  no failures/skips. `git diff --check` passed. Raw ignored evidence uses
  `005-reviews-red.txt`, `005-head-return-red.txt`, `005-review-ownership-red.txt`,
  `005-fix-budget-red.txt`, `005-comments-red.txt`, `005-agent-red.txt`,
  `005-foundation-green.txt` and `005-foundation-check.txt`.

These are intentionally uncommitted Build 005 foundations. Remaining work includes
claiming/releasing review jobs, validating model reports before publication, gathering
all actual commits/diff/contract input, reviewer-task continuation, coordinator triage,
verified correction/republication and same-reviewer revalidation, then a live seeded
finding/fix/sign-off rehearsal. The existing Build 004 fixture used a 15-minute job
budget; do not reset its expired budget to manufacture a successful continuation.
Prepare a separately identified supervised review fixture when needed, preserving the
existing completed implementation evidence. No new live review task or comment was
sent by the foundation tests. Build 005 must not be committed/marked complete before
its complete live gate; Builds 006–008 and both milestone reviews remain pending.

### Build 005 coordinator boundaries — in progress

Revalidated the working tree and Build 005 contract; the preceding goal turn made
concrete progress (Build 004 was pushed, and review foundations passed regression).
Added serialized code-review claims for published, authorized, reconciled jobs. Claims
respect global reservations, pause, project availability and intake-invalid fencing,
advance the lease epoch and retain attempt evidence. Successful review releases the
lease into the pending E2E stage only with current-head code sign-off and no active
turn or pending operation. The ordinary E2E transition now enforces the same active/
pending-work restriction. No E2E task is started by this handoff.

Separated `Reviews.validate` from `record`: the coordinator can reject a stale,
self-reviewed, incomplete or unsupported sign-off before publishing any comment,
without manufacturing a placeholder report URL. Persisting a report still requires
its actual canonical owned-PR comment URL and repeats validation. Added `ReviewInputs`
to collect real local Git commit history, each commit's patch and the aggregate diff,
checking the owned published PR's number/head/base/branch/state and clean workspace.
Changed targets fail closed; input is bounded at 1,000 commits/512 KiB of patches.
Large inputs block for operator action rather than silently omit review coverage.

Observed red/green:
- Review-claim stubs produced 10 passes/2 failures: an occupied/invalid claim was not
  rejected and a published job remained pr-open instead of acquiring code-review.
  Implemented fenced claims/handoff; the review/store/scheduler suite passed 32 tests.
- Prepublication validation initially did not reject invalid draft reports (12 passes,
  1 failure: missing expected exception). Moved the existing validation into a shared
  non-mutating method; the same 13 ledger cases passed, including unchanged operation
  count during validation and actual URL requirements during persistence.
- Real-Git input tests first failed both cases: wrong head/empty commit coverage and
  missing rejection for a different PR. Implemented collection and drift/scope checks;
  all 35 review-input/ledger/store/scheduler tests passed after formatting. These cover
  two actual commits, aggregate diff, changed remote head/base, wrong PR, dirty output,
  blocked active-turn handoff, SQLite persistence and existing schema upgrade.

Ignored evidence: `005-review-claim-red.txt`, `005-review-claim-green.txt`,
`005-report-validation-red.txt`, `005-report-validation-green.txt`,
`005-review-input-red.txt`, `005-review-input-green.txt`.
No new live task, GitHub comment or production service change occurred in this step.
Next required implementation is the actual review-round coordinator: collect/bind
these inputs, start or reconcile the independent reviewer, validate terminal structured
output before posting, then run coordinator triage/accepted fixes/reverification and
same-reviewer revalidation. Preserve the original job deadline and correction budget.
The CLI and live seeded-defect rehearsal must exercise that complete path before the
single primary Build 005 commit. Build 005 remains incomplete and uncommitted.

Coordinator-boundary regression: `npm run check` exited 0 after the final changes:
**48 unit + 116 integration + 4 CLI E2E = 168 passed**, zero failed/skipped. Raw output
is ignored `harness/build/005-coordinator-boundaries-check.txt`; `git diff --check`
passed. This is regression evidence for the current intermediate work, not completion
of Build 005 or live review acceptance.

### Build 005 review-round coordinator — in progress

Added `CodeReviewRound` connecting the actual input collector, independent app-server
adapter, report validator, attributed comment publisher and durable review records.
It supplies the full commit/diff/contract and prior evidence, persists the round prompt
and original absolute job deadline, requests structured reviewer output, monitors
approval/cancellation/budgets, and validates terminal output before publication. It
re-fetches authorization and the PR/workspace target before and after posting. Report
publication and the recorded head/base remain distinct from final E2E handoff. Public
findings/blocked reports cannot qualify as sign-off; a completed round can replay its
recorded result without starting another task or posting another report.

Added explicit owned-task reuse to `ExecutionAgent` so correction re-review stays with
the original independent reviewer and starts a separately correlated turn. Recorded
role cannot be changed by reusing a task. A new/different turn is rejected before any
RPC side effect while another turn is reserved; reconciliation of the exact recorded
turn remains allowed. `CodeReviewRound` uses the first owned code-review task for
subsequent rounds. Implementation and E2E identities remain separate.

Observed red/green evidence:
- Seven round-coordinator tests initially failed: no published exact-head report,
  missing invalid/drift/failed/expired rejections, missing public findings and absent
  approval wait. Implemented the connected round; all seven passed. These use actual
  SQLite review/operation state and the real PrComments delivery logic, with modeled
  app-server/GitHub/input boundaries already exercised by their adapter suites.
- Follow-up tests reproduced a second thread/start instead of reviewer reuse and
  admission of another turn while one was reserved (17 existing passes/2 failures).
  Role-preserving alias records plus pre-send reservation checks fixed both; combined
  round/adapter suite passed 26 tests. No thread/turn replacement is inferred from a
  timeout or missing result.
- Added a combined lost-comment-response replay test: it passed against the persisted
  round and exact-body/author reconciliation, with one comment and one task intent.
  Another test exposed a late completed observation being accepted after a timeout
  (8 passes/1 failure: missing expected rejection). Persisted a review-stop intent and
  retain that stop across replay; late completion and another invocation both refuse
  publication. The round/adapter suite then passed **28 tests**, exit 0, no skips.

Ignored evidence: `005-round-red.txt`, `005-round-green.txt`, `005-followup-red.txt`,
`005-followup-green.txt`, `005-round-recovery-red.txt`, `005-round-recovery-green.txt`.
No live review task or report was sent in these tests. The complete correction loop,
CLI integration and seeded live finding/fix/re-review gate remain pending. Next, use
this round within the outer coordinator: structured main-task triage with public
rationale/contracts, bounded accepted-finding implementation, configured verification
and publication, then same-reviewer revalidation until sign-off or an honest blocker.
Only after that complete live gate may Build 005 receive its primary commit.

Review-round regression: final `npm run check` exited 0 with **48 unit + 127 integration
+ 4 CLI E2E = 179 passed**, zero failed/skipped. Ignored output:
`harness/build/005-round-check.txt`. `git diff --check` passed. These changes remain
uncommitted as part of Build 005; no partial-build commit, live acceptance claim,
review sign-off on the milestone PR, merge or deployment is implied.

### Build 005 correction loop and CLI — live acceptance in progress

Added `ReviewCoordinator` around review rounds: preserve the original job deadline,
obtain structured implementation-task triage without edits, validate complete finding
coverage, publish public rationale/acceptance/verification before corrections, charge
persistent correction budgets, implement accepted changes on the original task, commit
and run configured sandboxed checks, update the same PR, publish actual check evidence,
and return to the original reviewer. Deferred/rejected decisions return for independent
assessment; unresolved disagreement and exhausted budgets block. A sign-off releases
the job only after a fresh target/authorization check and the existing ledger gate.
Task/cycle/triage/correction checkpoints retain progress rather than repeat completed
sends. Added `code-review CONFIG JOB_ID` to claim one published job and run the loop;
success means pending E2E, not readiness or approval to merge.

Extracted the already-tested command evidence runner into `CommandEvidence`, used by
both implementation and corrections, and the review wait loop into `waitForAgent`.
The behavior-preserving extraction retains isolation, artifacts, approval handling,
authorization cadence and persistent timeout stops. Added the guarded verifying→
code-review transition for corrections only when an existing PR is recorded.

Three actual-Git/sandbox integration cases failed before implementation: the seeded
finding did not reach E2E handoff, and neither failed-verification nor invalid-triage
cases performed the required review. After implementation all three passed, alongside
existing implementation/round cases (**18 passed**). The successful case exercises
public triage, an actual corrective commit, a real passing node:test command in the
sandbox, push to a local bare remote and same-reviewer sign-off. Failed checks and
unknown finding IDs block; invalid triage performs no fix. App-server/GitHub responses
are modeled here; mandatory live acceptance follows separately.

Full `npm run check` after CLI integration and formatting exited 0: **48 unit + 130
integration + 4 CLI E2E = 182 passed**, zero failed/skipped. Ignored evidence:
`005-cycle-red.txt`, `005-cycle-green.txt`, `005-cycle-check.txt`. The CLI E2E suite
still covers its existing configuration commands; the actual code-review CLI will
be exercised by the live rehearsal, not inferred from these tests.

The new `rehearse-review.mjs` performs a fresh supervised implementation, deliberately
seeds a known outer-whitespace greeting defect with passing smoke tests, independently
confirms the defect, invokes the actual code-review CLI, and requires public finding,
triage/fix/check evidence and same-task final-head sign-off. It independently checks
the corrected module afterward. The implementation rehearsal accepts a bounded
900–21600-second fixture job budget so this separate review fixture can run within a
single original six-hour deadline; it does not reset an existing job's budget.

First live launch stopped before any task/turn creation: the fresh runtime discovered
still-authorized old fixture issue #5 before newly created issue #7. Its deterministic
branch already existed beyond the base, so worktree ownership validation blocked.
Authoritative stored operations showed only completed budget/plan and pending local
workspace-create for the old issue; neither job had task/turn intent, active turn or
lease. Removed #5's stale codex-ready label, closed/unlabelled unused #7, and cancelled
both local fixture jobs. The old local preparation remains cancel-requested/blocked
with its intent retained, not falsely completed; the unused queued job is cancelled.
Preserved all evidence at `005-live-review.json` and its implementation artifact.
No implementation turn was retried or replaced. Added a fixture preflight refusing
any prior open codex-ready issue before creating another isolated rehearsal.

A separately identified retry is now running with evidence at
`harness/build/005-live-review-retry.json`. It is not yet acceptance evidence. Keep
observing that exact process/runtime; never relaunch because an observation times out.
Build 005 remains uncommitted until the full live gate passes.

Live retry implementation initially stopped immediately after recording its accepted
turn, with a generic implementation-error and the reservation retained. The original
raw observation error was not persisted, so its precise cause is not established.
Authoritative inspection of task `01a0c12d-d324-7492-84a1-07c338ccaea1`, turn
`01a0c12d-d3c7-7363-9e91-c2255048c3b9`, first showed inProgress and then, at
2026-09-20 23:39:03 UTC, completed/notLoaded before its 23:41:41 turn deadline.
No replacement task/turn was started and no interruption was needed.

Added test-first recovery for this retained expired reservation: two new cases failed
(19 passes/2 failures), demonstrating refusal of completed-task continuation and an
unhandled transient read. `proveCompleted` now returns the verified task/turn identity;
explicit publication continuation may reconcile a stale owned reservation only with
that exact proof and expired lease, fresh authorization and all prior project/global
fences. Missing/mismatched proof cannot clear the reservation. Separately, read-only
thread metadata/history requests retry at most three times; side-effect sends do not.
Exhaustion has a fixed observation-unavailable blocker. These changes do not establish
which original read failed or turn transport errors into successful execution.
The affected adapter/implementation/correction suites passed **30 tests**. Evidence:
`005-live-recovery-red.txt`, `005-live-recovery-green.txt`.

The explicit continuation returned pr-open, exit 0, using the same task, turn and
original six-hour job deadline. [Issue #8](https://github.com/talaniz/prime-mover-fixture/issues/8)
now has [draft PR #9](https://github.com/talaniz/prime-mover-fixture/pull/9), initial head
`08425f0e21b373935b902d4e4883c66df36431f5`, base
`eee4090de3540b66a25e2ee9195ada3bbec68f00`. Independent normal/trimmed/invalid-input
assertions and configured tests passed. Preserved the initial failure plus continuation
in the implementation evidence; ignored verification/continuation helpers start no
replacement implementation and refuse the wrong continuation phase.

The same job `ca4050a9-4f27-4b94-89a8-30f7cfbc449e` then received the deliberate
seed at `43bec933e1ca9064a8d03516e4914d0a0d084f24`; its smoke tests passed and an
independent assertion confirmed the outer-whitespace defect. The actual code-review
CLI started distinct reviewer task `01a0c134-c48e-7c43-8db7-064589335e8c`, which posted
[changes requested](https://github.com/talaniz/prime-mover-fixture/pull/9#issuecomment-5753613857).
The coordinator published triage/contracts and used the original implementation task
for correction. Configured verification passed on corrective head
`e551f21f408e05d351aca388ca07a8908c5d8772`, and re-review is now running on the same
independent reviewer task. Final sign-off and independent final acceptance are not yet
claimed; continue observing the existing rehearsal rather than relaunching it.

### Build 005 — live gate completed and primary delivery

The first corrective re-review completed at the correct head but combined sign-off
with a limitation describing an already-resolved `spawnSync EPERM` tooling failure.
The strict gate rejected that contradictory report before publication. It did not
silently remove the limitation or self-approve. Added a bounded clarification cycle:
the same reviewer must independently distinguish unresolved evidence gaps (blocked)
from resolved tooling issues (checks with the verified alternative). Original report,
clarification intent and task identity remain durable. Explicit `resume-code-review`
requires authoritative last-turn completion, fresh authorization and fenced reclaim;
it preserves original task identities, pending operations and the six-hour deadline.

Meaningful clarification/reclaim red: 22 passed, 4 failed; affected regression green:
50 passed (`005-clarification-green.txt`). Final `npm run check` exited 0 with **188
passing tests**: 48 unit, 136 integration, 4 CLI E2E, plus strict TypeScript compilation
(`005-final-check.txt`). Shared command evidence and turn waiting were extracted without
changing their contracts; implementation/correction regressions remained green.

The existing job resumed once and returned `e2e-review`, exit 0. The same independent
reviewer task `01a0c134-c48e-7c43-8db7-064589335e8c` clarified in turn
`01a0c140-4925-72d2-a5ca-746ba6325e86` and published
[exact-head code sign-off](https://github.com/talaniz/prime-mover-fixture/pull/9#issuecomment-5753674091)
on `e551f21f408e05d351aca388ca07a8908c5d8772`, base
`eee4090de3540b66a25e2ee9195ada3bbec68f00`, covering all three new commits. Both
[findings](https://github.com/talaniz/prime-mover-fixture/pull/9#issuecomment-5753613857)
have public [accepted contracts and triage](https://github.com/talaniz/prime-mover-fixture/pull/9#issuecomment-5753617010)
and reviewer-confirmed resolutions. The reviewer independently verified regression
coverage against the prior broken implementation and retained the tooling resolution
in its checks. This is an attributed comment, not a formal GitHub approval.

At 2026-09-21 00:02 UTC, final acceptance independently verified trimming, preserved
internal spaces and rejection of empty/whitespace/non-string values in the isolated
worktree; reviewer identity differs from the implementer, remote head/base match the
report, no active turn/lease remains, and the job is `e2e-review`. A fresh GitHub read
confirmed PR #9 is open and **draft**. Retained `005-live-review-retry.json` records
initial failure separately from successful continuation. No replacement fixture,
implementation or correction was launched to bypass the failure. No production
service, merge or deployment occurred.

Build 005 acceptance is complete. Its primary commit includes implementation, tests,
operator documentation and this log; Builds 006–008 and independent milestone delivery
reviews remain pending. General recovery of unknown side-effect intents remains Build
007 scope; explicit continuation does not erase uncertain external actions.

### Build 006 — acceptance and verification contract (in progress)

Build 005 is committed/pushed as `aebe9c5897e164f57449097efddffbef6fa74c38`.
Build 006 starts on the same branch. The next increments must demonstrate: a third,
distinct E2E task can record actual success/failure workflow evidence only after
current-head code sign-off; code-only/source-only/missing-environment reports cannot
mark ready; E2E fixes return through code review; remote head/base/conflicts/checks
and unresolved findings gate readiness; durable marker-based notification reconciles
ambiguous sends without duplicates. Readiness is revoked on later invalidation and
never authorizes merge/deploy. Test existing state transitions and report recording
first, then coordinator/transport and actual supervised fixture E2E. Final live gate
must retain distinct reviewer identity, evidence and one logical readiness comment.

Build 006 first red exposed an actual missing guard: direct `e2e-review → ready`
succeeded with code-only evidence (missing expected exception). Three additional
report-contract tests rejected the new E2E role because only code reports were
supported. Added role-specific immutable reports, independent code/E2E identities,
exact acceptance text and observed success/failure workflow evidence. A source-only
report, failed workflow or unresolved environment limitation cannot sign off. These
four tests plus the existing review ledger passed **18 tests**.

E2E round red rejected `e2e-review-1` as invalid-review-round; the adapter role test
failed invalid-agent-role (21 existing passes). Generalized the existing bounded
round and adapter to supply workflow-specific E2E instructions/schema without changing
implementation/code role contracts. **53 affected tests passed**.

The readiness contract initially had no dedicated gated completion API (15 failing
truth-table/API assertions). Added fresh head/base/open/mergeable/check evidence,
configured current-head command results, separate matching sign-offs and reconciled
notification requirements; direct stage transitions remain forbidden. Initial green
exposed a nested SQLite transaction error in evidence recording. Fixed it with one
atomic readiness evidence/state transaction; **37 affected tests passed**. Revocation
preserves review and notification evidence and exposes a blocked state.

The E2E correction integration initially lacked an E2E claim (3 passes/1 failure).
Generalized bounded coordinator rounds: an E2E correction is committed, verified and
pushed through the existing publication path, then returns to the original code
reviewer before the distinct E2E reviewer revalidates. The test uses real Git and
isolated verification with simulated model/GitHub boundaries. It proves the order
code → E2E finding → correction → code → E2E sign-off; **33 affected tests passed**.
This is integration evidence, not a claim of a live model finding in Build 006.

GitHub readiness adapter tests initially lacked the new reader (4 failures). The
reader checks the exact PR and current base, bounded complete check/status pages,
classic/ruleset requirements on protected branches, and re-reads the PR for drift.
Unavailable reads, conflicts and unresolved checks fail closed. A test routing bug
initially confused branch and rules endpoints; corrected the fixture and **19 affected
tests passed**. Adapter design was checked against the official GitHub REST docs for
[pulls](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request),
[commit statuses](https://docs.github.com/en/rest/commits/statuses#get-the-combined-status-for-a-specific-reference),
[check runs](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference)
and [branch rules](https://docs.github.com/en/rest/repos/rules#get-rules-for-a-branch).

Four readiness-notification tests initially failed because delivery was not wired.
The implementation now persists a stable attributed message and outbox intent, uses
exact marker/body/author reconciliation, and acknowledges only observed delivery.
A lost response after acceptance recovers without another POST; uncertain absence
retains its reservation; withdrawn authorization creates no notification. **23 affected
tests passed**. The comment includes owner, exact head/base, verification/check and
review evidence and remaining human approval; it does not claim email/push delivery.

Initial full `npm run check` exited 0: **218 tests passed** (48 unit, 166 integration,
4 CLI E2E) plus strict TypeScript; `git diff --check` passed. Evidence files are
`006-e2e-evidence-{red,green}.txt`, `006-e2e-agent-red.txt`,
`006-e2e-round-{red,green}.txt`, `006-readiness-{red,green}.txt`,
`006-e2e-cycle-{red,green}.txt`, `006-github-readiness-{red,green}.txt`,
`006-notification-{red,green}.txt`, and `006-initial-check.txt` under ignored build output.

A live read of fixture PR #9 confirmed exact head/base, open/mergeable state and no
reported/required GitHub checks. Configured local verification remains mandatory.
The supervised `rehearse-e2e.mjs` continuation is now running against the existing
Build 005 job/PR, preserving original task and elapsed budget. Its evidence path is
`harness/build/006-live-e2e.json`. Do not relaunch while its execution or remote turn
is unresolved. Live E2E acceptance and Build 006 completion are not yet claimed.

### Build 006 — live E2E, readiness revocation/recovery and primary delivery

Live E2E completed on fixture [PR #9](https://github.com/talaniz/prime-mover-fixture/pull/9)
at unchanged head `e551f21f408e05d351aca388ca07a8908c5d8772`, base
`eee4090de3540b66a25e2ee9195ada3bbec68f00`. Task
`01a0c15c-f598-7a23-959d-0a9caf4980ca`, turn
`01a0c15c-f68e-7be0-be4d-5718f062a345`, differs from both the original implementer and
code reviewer. It published [exact-head E2E sign-off](https://github.com/talaniz/prime-mover-fixture/pull/9#issuecomment-5753880051)
after actual module invocations covering normal input, outer trimming, preserved
internal spaces, empty/whitespace and multiple non-string rejection cases, and normal
operation after failures. All 17 fixture tests passed. It independently ran restored
regression coverage against the prior broken implementation and observed the expected
one failure. No files were edited, no environment gap was waived and no replacement
task was used. Both independent reports cover all three commits and the same head/base.

The coordinator published exactly one [owner readiness comment](https://github.com/talaniz/prime-mover-fixture/pull/9#issuecomment-5753881270),
then rechecked remote evidence and released the job to `ready`. The acceptance driver
independently invoked the module in the isolated workspace, checked distinct reviewer
identities, exact remote head/base, one acknowledged notification, no lease/turn/pending
operations and a successful `recheck-ready`. Evidence: `006-live-e2e.json`; completed
2026-09-21 00:30 UTC. These are attributed comments, not formal GitHub approvals.

A final contract inspection identified a deadline gap in readiness completion. Added
an expired-budget assertion that failed with a missing expected exception (16 passes,
1 failure); readiness now requires the original execution deadline while entering
ready. Rechecking an already-ready result does not expire an otherwise valid delivery
merely because execution time has elapsed. Added a required-app identity regression
(reject wrong app with the same check name, accept the pinned app). **30 affected tests
passed** after the change; `006-deadline-{red,green}.txt` records the actual results.

The live recovery gate injected `failure` for fixture commit status
`prime-mover-fixture/readiness-gate`. `recheck-ready` exited 1 and changed `ready` to
`blocked/readiness-check-failed`. The status was then restored to `success`; explicit
completed-task continuation returned through code and E2E gates to `ready`. Recheck
passed. All seven original model turn IDs and the original absolute job deadline were
unchanged; there were **zero new turns**, one readiness outbox record and exactly one
remote readiness comment. This tests real GitHub check failure, revocation and recovery,
not an assumed notification retry. Evidence: `006-live-readiness-recovery.json`,
completed 2026-09-21 00:32 UTC. The fixture status remains successful. A fresh GitHub
read confirms PR #9 is still open and draft on the reviewed head/base.

Final `npm run check` exited 0: **220 passed** (48 unit, 168 integration, 4 CLI E2E),
strict TypeScript and whitespace checks passed (`006-final-check.txt`). Shared review
coordination was extended instead of duplicating correction/publication machinery;
the prior implementation and code-review regressions remain green. Build 006 is
complete; its primary commit contains code, tests, live scripts, operator documentation
and this log. Builds 007–008, DOOM integration, CI and independent milestone reviews
remain pending. No production service, merge or deployment was activated.

Pre-commit diff review found an asymmetric reviewer-identity guard: the E2E task was
rejected as the first code reviewer, but a later code report could reuse its ID under
a newly recorded code-role key. A focused regression produced 4 passes/1 failure
(missing expected exception, `006-independence-red.txt`). The evidence store now rejects
any reviewer identity already owned by implementation or the other review role,
independently of operation-key prefixes. Existing live reviewers are distinct and
remain valid. Final post-fix `npm run check` exited 0 with **221 passes** (48 unit,
169 integration, 4 CLI E2E), no failures/skips; latest `006-final-check.txt` supersedes
the earlier 220-test run. Credential/artifact scan and staged whitespace checks passed.

### Build 007 — acceptance and verification contract (in progress)

Build 006 is committed/pushed as `8267357fcfda471fda0e65f42526ccba256a60e7` on the
same milestone PR. Build 007 must reconcile every nonterminal job and pending side
effect before intake; uncertain external ownership remains fenced. Existing live
fixture #8/PR #9 is ready with its successful supervised status and retained evidence.
Do not reset its database or original deadlines to simulate recovery.

First increment: injectable mount/space evidence must reject wrong UUID, read-only,
full/low-space or inode-exhausted storage before runtime directories/SQLite are created;
no fallback to the Pi root volume. Preserve existing symlink/device checks. Subsequent
increments cover persisted retry/deadline recovery, stage-aware startup reconciliation,
redacted diagnostics, bounded worker/service operation, SQLite-consistent backup and
isolated restore, retention and supervised service/dependency restart. Unknown writes
must never be guessed absent or blindly replayed. Define fault outcomes per boundary
in a checked-in recovery matrix, then prove them with tests and supervised evidence.

Initial read-only Pi observations: expected ext4 UUID is mounted rw at
`/media/talaniz/postgresdata`, approximately 28 GiB available; memory reports about
1.9 GiB available of 3.8 GiB, with the existing 199 MiB swap fully used. `/etc/fstab`
contains only root/boot/proc entries, so persistent external mounting is not proven by
that file. No matching codex/app-server unit file was found in the inspected system
or user unit directories. The existing daemon socket remains usable; do not assume
it is managed by a named systemd service or restart it. Ship explicit mount/dependency
contracts and prove supervised ordering without enabling production service or changing
unrelated DOOM/PostgreSQL/n8n data. Production installation/activation stays owner-gated.

Build 007 storage increment: the initial injected-probe test failed because storage
preflight had no injection boundary (9 passes/1 failure). After introducing a native
mount/statfs probe with unchanged mount semantics, the four intended capacity cases
failed with missing expected exceptions: full, low-space, inode exhaustion and unknown
capacity (6 passes/4 failures). Added an optional positive `storage.minFreeBytes`,
default 512 MiB, preserving older configuration round trips. Its configuration test
first failed on the unsupported field (23 passes/1 failure). Preflight now checks
available bytes and inodes before creating runtime state; wrong UUID/read-only/symlink
and device guards remain. **38 storage/config/CLI tests passed**. Evidence:
`007-storage-red.txt`, `007-storage-capacity-red.txt`, `007-config-reserve-red.txt`,
`007-storage-green.txt`.

Backup/restore increment: three new API tests failed because snapshot/restore methods
were absent. Added Node's SQLite online-backup API with exclusive mode-0600 destination,
60-second progress budget, schema/integrity/foreign-key checks, streaming SHA-256 and
standalone snapshot validation. Restore copies only to a new file, refuses existing
main/sidecar files and corrupt input, and verifies the copied snapshot before accepting
it. **21 backup/store tests passed**, including a second writer's WAL commit, preserved
leases, unknown task intent and consumed retry budget. Evidence:
`007-backup-{red,green}.txt`.

Two operator CLI tests initially failed because `backup` and `restore-check` were
unknown commands. Added mount-guarded, path-scoped commands: backups must be below the
runtime's `backups/`, isolated restores below `restores/`. Restore validation pauses the
copied database and starts no execution. Existing output is never overwritten.
**9 backup/CLI tests passed**, including attempted active-database overwrite and path
escape (`007-backup-cli-{red,green}.txt`). These are database snapshots only: external
workspaces/artifacts and credentials are not copied; complete recovery instructions
must make that distinction explicit and must not run a restored clone concurrently.

Supervised live backup/isolated restore passed against the existing fixture runtime
at 2026-09-21 00:53 UTC. Snapshot SHA-256
`bc0fd0a33bcb9b4b2efa0e7ab2cbdfd4378e617cdf1933bf9e30c611973cec45`, schema 2,
contains **1 job, 56 operations and 157 events**. Jobs, operations and consumed budgets
match the source; the source remains ready/unpaused, the restored copy is paused and
no model execution starts. Backup mode is 0600. Evidence:
`007-live-backup.json`, `007-live-restore.json`, `007-live-backup-proof.json`.
The private files remain under the fixture runtime's backups/restores directories.

Build 007 is still in progress and uncommitted. Startup/stage reconciliation, persisted
transport recovery budgets, worker/service orchestration, resource diagnostics,
retention/runbooks and supervised service/dependency restart gates remain. Do not create
a partial primary Build 007 commit or claim MVA readiness. Existing fixture job/PR
and all earlier evidence remain intact for subsequent controlled rehearsals.

Startup recovery primitives now have test-first coverage. Four recovery-lease tests
initially failed because adoption/continuation APIs were absent. `claimRecovery` now
fences an expired owner with a new epoch while preserving stage, task/turn IDs and all
pending intents; live leases and competing reservations cannot be adopted.
`resumeRecovery` atomically preserves the original deadline, charges a durable bounded
recovery-attempt budget and resumes only a publication-compatible stage. Cancellation
or an expired execution deadline permits observation ownership but forbids continuation.
**47 store/adapter/backup/recovery tests passed** (`007-recovery-lease-{red,green}.txt`).

Three app-server reconciliation tests initially failed on the absent recovery API
(22 existing passes). `reconcileRecorded` now correlates only persisted source/cwd and
client message IDs, verifies owned history, and records accepted identities even after
cancellation. It sends neither thread/start nor turn/start. A lost accepted turn can
be interrupted only after exact ownership is established; a missing uncertain send
remains pending and is never replayed. A uniquely correlated empty task is recorded
without starting a replacement or a turn. **29 adapter/recovery tests passed**
(`007-agent-recovery-{red,green}.txt`). These are adapter primitives, not yet a complete
startup coordinator. `docs/recovery.md` records the required fault outcomes and the
scope of database-only backup/restore. No partial Build 007 commit has been made.

The recovery scheduler now supports observation under a valid fencing lease after
cancellation or authorization withdrawal, without relaxing `assertActive` for new
execution. Two new tests first failed at the old scheduler's cancellation guard
(`007-scheduler-recovery-red.txt`: 2 pass, 2 fail). Recovery renews only ownership
while aborting the execution signal; a terminal owned turn can finalize cancellation,
whereas uncertain remote state retains its reservation. A successor epoch fences the
old observer and aborts its signal. **34 scheduler/recovery/adapter tests passed**
(`007-scheduler-recovery-green.txt`).

The pre-intent crash window also has test-first coverage: two new tests failed on the
missing budget-recovery API (`007-initial-budget-red.txt`: 4 pass, 2 fail).
`recoverExecutionBudget` uses the earliest persisted claim time, never restart time,
and preserves an existing deadline even if configuration changes. Missing budgets
with existing operations, pending notifications, task/turn identity or publication
require reconciliation; expired budgets cannot be recreated. The first implementation
exposed a nested SQLite transaction (53 pass, 1 fail, retained in
`007-initial-budget-nested-transaction-failure.txt`); replacing it with a single atomic
budget record/event transaction produced **54 passing recovery, scheduler, store and
adapter tests** (`007-initial-budget-green.txt`). Strict compilation and diff whitespace
checks also passed. These APIs still require startup coordinator wiring; Build 007
remains in progress with no primary commit yet.

Startup reconciliation is now wired ahead of `run-once`, with a separate
`recover-once CONFIG` command that cannot claim a new queued job. Five startup tests
first failed on the missing coordinator (`007-startup-red.txt`). The coordinator
scans all jobs and pending operations/notifications, leaves live leases untouched,
fences one expired owner, refreshes authorization, observes only the latest recorded
owned task/turn, and permits the recorded workflow to continue only within its original
deadline and durable recovery-attempt limit. Withdrawal/expiry permits observation and
stopping only; failed turns and uncertain responses do not start replacements. Ordinary
blocked jobs without outstanding ownership/intents are not automatically retried.
Seven startup behavior cases now include expiry and terminal turn failure.

Eight route tests first failed on the missing route selector
(`007-recovery-route-red.txt`). Recovery restores implementation, review, correction
or post-correction verification stages from persisted cycles, preserving pending
correction targets and routing completed E2E fixes through fresh code review. The CLI
shares its existing review/readiness delivery path with recovery. The initial extraction
needed TypeScript narrowing fixes for captured Store references; no check was waived.
Focused wiring checks passed **28 tests** (`007-startup-wiring-green.txt`), then
`npm run check` passed strict TypeScript plus **262 tests: 65 unit, 191 integration,
6 CLI E2E** (`007-startup-full-check.txt`). `git diff --check` passed.

A supervised live `recover-once` against fixture #8 / draft PR #9 returned `clear`
at 2026-09-21 01:33:48 UTC, exit 0. Exact before/after comparison of jobs, operations,
events, budgets, outbox and attempts found no changes: 1 job, 56 operations, 157 events,
1 budget, 1 notification, 8 attempts. The job remains ready with no active turn/lease;
no new task or model turn was requested. Evidence: `007-live-clear-recovery.json`.
This proves the clear-ledger path, not a live interrupted-worker restart. Expanded
crash-point tests, persisted transport limits, service orchestration/resources/retention,
and supervised dependency/restart gates remain before the Build 007 primary commit.

Transport read failures now consume the durable per-job `transport-failures` budget,
using configured `limits.transportAttempts`. A new adapter test first failed because
retries returned `agent-observation-unavailable` and reset per call
(`007-transport-red.txt`: 25 pass, 1 fail). The passing test closes/reopens SQLite,
constructs another adapter, proves no extra execution read or replacement task starts
after exhaustion, then proves bounded observation can still stop the exact owned turn.
Read-only diagnostic/stop attempts remain bounded; task/turn writes are never retried.
Private exception text is not persisted. Startup treats exhausted transport allowance
as observation-only. **33 adapter/startup tests passed** (`007-transport-green.txt`).

An additional startup test exposed observation of the newest task while an older task
send remained uncertain (`007-ambiguous-intents-red.txt`: 7 pass, 1 fail). Startup now
refuses competing pending task/turn identities before selecting any remote task; all
intents remain reserved. Full `npm run check` passed strict TypeScript and **264 tests:
65 unit, 193 integration, 6 CLI E2E** (`007-transport-full-check.txt`). Diff whitespace
checks passed. Build 007 remains uncommitted pending its complete exit gates.

The Pi supports temporary user-service supervision: `systemd-run --user --wait
--collect --unit=prime-mover-build007-capability-probe --property=RuntimeMaxSec=10
/usr/bin/true` completed successfully (exit 0, 3 ms service runtime). This is a capability
probe only; it neither installs/enables a production service nor proves worker restart,
mount ordering or app-server dependencies. Those supervised gates remain mandatory.

The `cycle CONFIG` command now drives a single supervised workflow stage: storage and
app-server connection preflight, startup recovery, ready-result revalidation, then
one pending review stage or intake plus one implementation. Non-clear recovery stops
the cycle before intake. Paused intake revalidates ready results but starts no review
or implementation. Five cycle tests first failed because orchestration was absent
(`007-worker-cycle-red.txt`), then passed (`007-worker-cycle-green.txt`). Readiness
revalidation is shared with `recheck-ready`, and the existing review/readiness handler
is reused. Initial CLI extraction errors (duplicate helper in backup branch and
nullable captured Store) were caught by strict compilation and fixed before validation.

Evidence correction: focused commands naming `test/e2e/cli.test.mjs` did not run CLI
checks because that file does not exist; Node ignored the nonexistent path. The earlier
28-test startup wiring run and the 5-test cycle run therefore provide focused coverage
only. Full `npm run check` uses the actual `test/e2e/*.test.mjs` files and has passed:
**269 tests, 70 unit + 193 integration + 6 CLI E2E**, plus strict TypeScript
(`007-cycle-full-check.txt`). Prior full-suite totals remain valid. No nonexistent test
path is counted as evidence of CLI behavior. `git diff --check` passed.

A separate empty runtime was created at
`/media/talaniz/postgresdata/codex-work/operations-rehearsal-uvwzptef`, mode 0700,
with a private configuration and intake paused. It does not reuse the live fixture's
ledger. A temporary `systemd-run --user --wait --collect --pipe` unit executed the real
`cycle` command on 2026-09-21 01:47:23 UTC: exit 0, result `paused`, runtime 1.080 seconds.
A second unit with an intentionally nonexistent app-server socket exited 1 at 01:47:54
UTC with `App-server connection failed`; jobs, operations and attempts remained zero.
Evidence: `007-operations-runtime.json`, `007-service-cycle-proof.json`, and
`007-service-missing-dependency-proof.json`. Both units were collected; no persistent
production service was installed or enabled. This proves supervised cycle execution
and fail-closed dependency absence, not continuous service restart or boot mount ordering.
Those gates, service templates/resources/retention and live interrupted-work recovery
remain before completing Build 007. No partial primary commit has been made.

Graceful shutdown now propagates an external abort signal through the scheduler and
startup recovery. Two new scheduler tests first failed (`007-shutdown-red.txt`: 5 pass,
2 fail). A stopping service cannot claim queued work; an active handler sees cancellation
while retaining its owned turn until terminal reconciliation. **41 scheduler/startup/
adapter tests passed** (`007-shutdown-green.txt`). CLI execution installs/removes scoped
SIGTERM/SIGINT handlers and checks shutdown before cycle intake/review claims.

A sequential service loop and `scripts/worker-service.mjs` now run fresh cycle processes
with bounded consecutive failures, interruptible intervals and optional finite cycles.
Three loop tests first failed on the absent implementation, then **10 loop/scheduler
tests passed** (`007-service-loop-{red,green}.txt`). Shutdown forwards SIGTERM to the
active cycle and allows 45 seconds for owned-work reconciliation before a forced child
group exit; uncertainty remains durable. Full `npm run check` passed strict TypeScript
and **274 tests: 73 unit, 195 integration, 6 CLI E2E**
(`007-supervisor-full-check.txt`). Diff whitespace checks passed.

Supervised live proof on the isolated empty paused runtime:
- A transient user unit with `RequiresMountsFor` completed two real supervisor cycles,
  both `paused`, then reported `completed` with 2 cycles (2026-09-21 01:54:31 UTC,
  exit 0, 2.634 seconds). Evidence: `007-supervisor-cycles-proof.json`.
- SIGTERM after the first real cycle woke the supervisor and reported `stopped` with
  exactly 1 cycle, exit 0 (01:55:02 UTC). Evidence: `007-supervisor-stop-proof.json`.
- A separate mount-dependency capability probe exited 0. These do not prove interruption
  of a live model turn or a reboot with the mount initially absent.

Worker and independent metadata user-service templates are in `deploy/`; both passed
`systemd-analyze --user verify`. They include mount requirements/condition, private
umask, restart rate limits and initial resource caps. Neither was installed/enabled.
`docs/service-operations.md` records execution, shutdown, mount, resource and recovery
limits and explicitly pending production gates. The external UUID was reverified as
`c6d768c3-187e-43b0-b14e-cb6c659d06f7`, ext4/rw. Pi memory snapshot: 3,981,369,344 bytes
total, 2,023,108,608 available; swap 209,711,104 total with 65,536 free. Caps still need
workload proof; RAM preflight, complete retention/upgrade procedures, actual dependency
ordering/restart fault matrix and persistent-mount acceptance remain before Build 007
completion. No primary Build 007 commit has been made.

Memory preflight now requires 256 MiB of Linux `MemAvailable`, without treating swap
as execution headroom. Three unit tests first failed on the absent implementation
(`007-memory-red.txt`). Parsing rejects missing, malformed, duplicate or unreadable
evidence with fixed redacted errors; reclaimable cache is correctly included. New
implementation/review claims and explicit resumes check the reserve. Startup recovery
can still observe/stop owned work when the resource gate denies continuation. The
additional resource-pressure recovery test verifies that no continuation occurs and
that the owned turn is reconciled. `doctor` reports available/minimum bytes.

Full `npm run check` passed strict TypeScript and **278 tests: 76 unit, 196 integration,
6 CLI E2E** (`007-resource-full-check.txt`). Live memory preflight passed on this Pi;
its timestamp and available bytes are in `007-live-memory-preflight.json`.
`docs/service-operations.md` now specifies conservative manual retention, capacity
response, backup dependencies and ordered upgrade/rollback procedures. No automatic
deletion, production mount change or service installation was performed.

A `crash-recovery` mode is prepared in the existing implementation rehearsal script
(optional argument after job seconds). It records a worker PID and accepted owned
task/turn, SIGKILLs only that worker, waits for real lease expiry, invokes `recover-once`
and asserts unchanged task/turn intents and original budget with a newer lease epoch.
It retains evidence rather than retrying fixture creation. Syntax validation passed;
this new mode has NOT run and is not live recovery evidence yet. Fixture #8 is still
open with `codex-ready`; retire that authorization deliberately before creating the
new rehearsal, preserving its PR and evidence. Build 007 remains in progress and
uncommitted; live crash recovery and remaining dependency/mount gates are next.

Live crash recovery passed at 2026-09-21 02:07:05 UTC. Before the new fixture, issue #8's
`codex-ready` label was deliberately removed after confirming its ledger had no lease,
active turn or pending operation. Its draft PR #9 and historical evidence are preserved.
A subsequent `recheck-ready` observed withdrawal and changed that retired local job to
`cancelled` (expected exit 1; `007-retired-fixture.json`). It is no longer a live ready
fixture and must not be resumed as though authorization remains present.

The new private fixture is issue #10 / draft PR #11:
https://github.com/talaniz/prime-mover-fixture/pull/11
Runtime: `/media/talaniz/postgresdata/codex-work/implementation-rehearsal-N1unsM`.
Job: `db4bc0b4-17eb-4957-9006-2947ffde31a2`.
The rehearsal reused the Build 004 greeting contract/helper with the new crash mode;
the issue title retains that helper's Build 004 label, while this is Build 007 evidence.
Worker PID 3508364 was SIGKILLed only after its accepted task/turn intents were durable.
After the real lease expired, `recover-once` adopted epoch 2 from epoch 1 and completed
verification, commit, normal push and draft PR publication. Exact before/after task/turn
intents and original job budget matched; there was no replacement task or model turn.
Owned task `01a0c1b6-4ccd-7543-a871-3cf1ec93df9e`, turn
`01a0c1b6-4d91-75a3-9089-0e0ca7b94163`, final head
`3b655d422a15d78ac66efc5196aa5edd84bcc45e`, base
`eee4090de3540b66a25e2ee9195ada3bbec68f00`. Configured verification and independent
fixture acceptance passed. The final stage is `pr-open`, no active lease/turn. Evidence:
`007-live-crash-recovery.json` and its log. The rehearsal process exited 0 and is finished.
Do not rerun this fixture-creation command. The new fixture remains authorized for
subsequent complete-cycle acceptance; its reviews/readiness have not yet run.

Supervised dependency ordering also passed: a transient worker requiring/ordered after
a delayed socket-check gate started at monotonic microsecond 3563712378001, after gate
exit 3563712254429, and executed a real paused cycle. Evidence:
`007-service-ordering-proof.json`. A failed prerequisite prevented its dependent worker
from executing (no marker was created). The initial assertion incorrectly expected a
nonzero `systemd-run --wait` exit; this host returned zero despite the blocked job.
The retained failure artifact is `007-service-failed-gate-proof.json`; authoritative
journal records explicitly show `JOB_RESULT=dependency`, captured in
`007-service-failed-gate-reconciled.json`. This is a proven dependency failure, not a
successful worker start. All temporary Build 007 units are stopped/collected; a final
unit listing was empty. Production services and shared app-server were not restarted.

Remaining Build 007 closeout: validate resource caps with a representative workload,
consolidate fault-boundary evidence and finish mount/operations acceptance documentation.
Actual production persistent-mount installation and unattended activation remain owner-
gated deployment work; no physical reboot or shared-daemon restart is claimed here.

Resource-limit audit found a real host limitation. The transient full check passed
278 tests (the pre-closeout test set) under the configured one-core CPU and 256-task
limits in 3 min 2.643 sec, exit 0 (`007-capped-check.{json,txt}`). While active, systemd
reported the requested memory settings but `MemoryCurrent=[not set]`; the kernel's
cgroup controllers are `cpuset cpu io pids`, without memory. `/proc/cmdline` explicitly
contains `cgroup_disable=memory`. Therefore this is NOT proof of enforced MemoryHigh/
MemoryMax. The original receipt's limits field records requested settings only.

A new resource test first failed on the absent controller guard
(`007-memory-controller-red.txt`: 3 pass, 1 fail). Worker `service-preflight` now fails
before unattended activation if the memory controller is absent; the metadata template
also checks it. The live preflight returned expected exit 1 and the fixed actionable
`memory-controller-unavailable` diagnostic (`007-live-service-preflight.txt`). Both
service templates still pass `systemd-analyze --user verify`. Deployment must review the
boot flag, schedule an owner-approved reboot, verify actual service cgroup memory.max
values and repeat the workload. No boot file or host service was changed. Ordinary
supervised cycle/doctor operations remain available; this gate is not bypassed by them.

The proposed `deploy/fstab.example` preserves the UUID mount and nosuid/nodev/error
options. Unprivileged verification found the device but could not read its filesystem
signature; privileged read-only `findmnt --verify` confirmed ext4 with no errors or
warnings (`007-fstab-{validation,privileged-validation}.txt`). The entry is NOT installed
and no physical reboot is claimed. Persistent-mount and memory-controller activation
remain part of the separately approved deployment window.

Fault-boundary coverage was consolidated in `docs/recovery.md`. Three additional tests
of existing command-evidence behavior passed: absent artifacts block without rerunning,
matching artifacts acknowledge the same intent, and mismatched artifacts remain pending
(`007-command-boundary-check.txt`). No artificial red was introduced for behavior already
implemented. Three startup assertions first exposed generic blocker text
(`007-blocker-reasons-red.txt`); recovery now distinguishes authorization, execution/
transport/recovery budgets, resources and failed/interrupted turns using stable codes.
Recovery attempt checks read the durable budget directly.

Final checks for this increment: `npm run check` passed strict TypeScript and **282 tests:
77 unit, 199 integration, 6 CLI E2E** (`007-closeout-check.txt`); `git diff --check` passed.
Build 007 remains uncommitted while the final scope/entrypoint audit is completed. In
particular, audit the standalone `poll` command against the recovery-before-intake
contract; automatic `cycle` already gates intake through startup reconciliation.

## Build 007 closeout

The standalone intake entrypoint audit found and fixed the last recovery bypass:
`poll` now refuses live or expired leases, active turns and pending operations/outbox
before contacting GitHub. Three actual CLI tests first failed because GitHub was
contacted (`007-poll-guard-red.txt`: 0 pass, 3 fail); they now pass. `cycle` continues to
perform startup reconciliation before intake. Operator issue reconciliation remains
explicit, and global execution claims still enforce the durable reservation invariant.

Final primary-build validation: `npm run check` passed strict TypeScript and **285 tests:
77 unit, 199 integration, 9 CLI E2E** (`007-final-check.txt`). Service templates pass
systemd verification; the proposed fstab entry passed privileged read-only validation.
Live worker-crash continuation, unchanged identity/deadline, verified draft publication,
backup/paused restore, sequential supervision, shutdown and dependency ordering/failure
have direct evidence in the entries above. The recovery matrix distinguishes live gates
from injected faults. Diff whitespace checks passed.

Build 007 implementation and supervised acceptance are complete. This primary build
includes all recovery, storage/resource, backup, CLI/supervisor, service-template,
operator-procedure and test changes together. No service is installed/enabled. Physical
boot verification, persistent mount installation, removal of the existing memory-disable
boot flag and proof of enforced memory limits remain owner-gated deployment prerequisites;
the service preflight fails closed on the current host. These are not reported as passes.
Build 008's complete MVA acceptance and linked DOOM Projects view remain pending, followed
by independent milestone code/E2E reviews, release notes and final-head revalidation.

## Build 008 — in progress

Build 007 prerequisite is committed/pushed as
`ff3c676bcae5733922d04f45b10c048e6d8d9c69`; remote branch equality and a clean worktree
were verified, and milestone draft PR #3 was updated through Build 007. Build 008
retains the complete MVA and separately reviewed DOOM Projects integration scope.

DOOM work uses an isolated clone at
`/media/talaniz/postgresdata/codex-work/repos/doom-prime-mover-mva`, branch
`feat/prime-mover-projects`. Fresh fetch verified local main = origin/main =
`6172f707bc87df84300502c5c761c93926a76e64` before branch creation. The live
`/home/palpatine/doom-control-room` checkout was only inspected and remains untouched.
Its AGENTS.md requires committed sanitized desktop/mobile screenshots and independent
review of the actual branch UI. Acceptance remains the complete metadata contract,
including auth, safe links/text, stale/unavailable/empty states and unrelated task access.

The DOOM metadata reader is now implemented test-first: four tests failed on the missing
module, then passed for default identities, strict projection/private-field removal,
trusted links, bounded counts, freshness, cached outages and concurrent request sharing.
The reader uses a fixed GET over the private Unix socket, a private token file, a 2-second
request bound and a 1 MiB response bound. The authenticated read-only Projects API was
then tested. Initial fixture startup lacked a mandatory admin account and its cleanup
waited for an already-exited child; that invalid red attempt was diagnosed and fixed.
The meaningful API red was `404 !== 200` for an authenticated GET. The implemented
list/detail endpoints pass, permit the read-only account, reject unauthenticated reads,
unknown IDs and writes, and do not expose token/private response fields. Five focused
reader/API tests and syntax checks passed. Raw artifacts currently reside in
`/tmp/doom-projects-{red,green,api-red2,api-red3,api-green}.txt`.

This is only the metadata bridge increment. Rendered UI, browser interactions and
screenshots, actual Prime Mover/DOOM integration, CI/fresh checkout, complete live
acceptance and final independent reviews remain pending. No Build 008 primary commit
or DOOM PR has been created yet; all changes remain isolated and reviewable.

The isolated DOOM full regression suite also passed: `npm test`, **22 tests**, zero
failures/skips (`/tmp/doom-projects-regression.txt`). Its `docs/prime-mover-projects.md`
records the acceptance/verification contract and outstanding UI/browser/integration
checks. Both repository whitespace checks pass. The failed first API-test process was
explicitly terminated after its child was confirmed exited; the repaired test and full
suite are finished. No live DOOM process was touched and no test process remains pending.

#### Build 008 progress — DOOM Projects screen

- Isolated DOOM branch `feat/prime-mover-projects` now has implementation commit
  `3adaa777538f82affe1045f474a5cdcfadaf0fb9` (base
  `6172f707bc87df84300502c5c761c93926a76e64`). Adds authenticated read-only
  metadata bridge and list/detail Projects screen, preserving task DOM/drafts,
  explicit snapshot freshness, loading/empty/unavailable states and scoped GitHub links.
- DOM test increment initially failed because the new component did not exist;
  recorded `/tmp/doom-projects-ui-red.txt`, then four behavior tests passed.
  A subsequent meaningful focus regression failed (`undefined` rather than DOOM
  Dashboard after refresh), then passed after preserving keyed keyboard focus.
  `/tmp/doom-projects-focus-{red,green}.txt` records that cycle.
- Final syntax checks pass and all **27 automated tests pass**:
  `/tmp/doom-projects-final-check.txt`. Chromium exercised actual admin/viewer
  sessions, list/detail, refresh, metadata outage while task controls stayed usable,
  draft preservation, forbidden POST, logout cleanup, desktop/mobile width and no
  JavaScript exceptions. Expanded browser run passed including empty/loading states:
  `/tmp/doom-projects-browser-expanded.txt`.
- Screenshot capture is running against committed DOOM UI code. Inspection, actual
  Prime Mover metadata integration, linked PR and independent reviews remain pending.
  These fixture browser results are not claimed as actual worker integration.

- DOOM screenshot evidence committed at `78547be81800b039c787639d1ae858593b193c9c`
  and pushed. All 14 desktop/mobile PNGs were opened and inspected; no private
  content or horizontal overflow, with long mobile cards naturally below viewport.
  Capture log `/tmp/doom-projects-capture.txt` passed. Native image viewing hit the
  environment's bwrap restriction; the same unmodified PNGs were inspected through
  tool image output from privileged read-only base64 reads.
- Linked draft integration PR: https://github.com/talaniz/doom-control/pull/14.
  Actual-service integration and independent review gates remain explicitly pending.
- Current live fixture #10 / draft PR #11 was read-only inspected at `pr-open`,
  no lease/turn/blocker. Started its existing job's `code-review` command, retaining
  runtime, original implementation identity and deadline. Log:
  `harness/build/008-live-code-review.log`. No new fixture issue/job was created.

- DOOM actual-service Chromium integration passed against Prime Mover
  `ff3c676bcae5733922d04f45b10c048e6d8d9c69` and DOOM
  `78547be81800b039c787639d1ae858593b193c9c`. Actual `metadata` CLI on the verified
  external filesystem served both default identities with synthetic jobs. Browser
  list/detail, same-number cross-project isolation, global lease contention,
  pause/active/queue/outcome/blocker display, unauthenticated denial and source-stop
  stale behavior passed. Durable execution-state digest stayed unchanged across
  reads and after source stop; unrelated task send controls remained usable.
  `/tmp/doom-projects-real-integration-green.txt`; sanitized receipt checked into DOOM.
- Initial actual-service attempt failed because the test chose the second card by
  index while real registry ordering differed from its fixture. Changed the test to
  select stable project ID. The initial failure is retained at
  `/tmp/doom-projects-real-integration.txt`; it is not reported as a product regression.
- Existing live fixture code review command completed successfully with result
  `e2e-review`; started separate E2E role on the same fixture/job. Its log remains
  `harness/build/008-live-e2e-review.log` while it runs.
- Added least-privilege deterministic GitHub Actions workflow with explicit Node
  22.23.2, immutable action SHAs verified from the official action repositories,
  disabled credential persistence, no repository secrets in tests, and bounded timeout.
  Workflow/fresh-checkout results are pending; this addition is not yet Build 008 complete.

### Build 008 live/fresh-checkout acceptance results

- Re-read the current Drive execution plan and mapped all MVA-1 through MVA-8
  criteria in `docs/mva-acceptance.md`, distinguishing verified fixture evidence
  from outstanding independent product reviews, CI and owner-approved deployment.
- `node scripts/verify-mva-fixture.mjs harness/build/007-live-crash-recovery.json
  harness/build/008-live-final-acceptance.json` passed. The new observation-only
  acceptance driver continues the already recovered fixture; it starts no tasks.
  Actual code and E2E review roles signed the same fixture head
  `3b655d422a15d78ac66efc5196aa5edd84bcc45e` and base
  `eee4090de3540b66a25e2ee9195ada3bbec68f00`; their task IDs differ from each other
  and implementation. Independent valid/invalid greeting checks passed. Exactly
  one readiness notification was found on GitHub, linked to both review reports.
  Sanitized IDs/reports/workflows are checked in at `harness/evidence/mva-live.json`.
- `node scripts/rehearse-readiness-recovery.mjs
  harness/build/008-live-final-acceptance.json
  harness/build/008-live-readiness-recovery.json` passed. Explicit fixture-only
  failing commit status revoked readiness; restoring success and reconciliation
  returned the job to `ready`, with **zero new turns**, the same original deadline,
  and the same logical notification. No production repository status was changed.
- Fresh local clone at `ff3c676bcae5733922d04f45b10c048e6d8d9c69` using
  `npm ci --ignore-scripts` and `npm run check`: **285 passed** (77 unit,
  199 integration, 9 CLI E2E), strict TypeScript passes, zero audit findings.
  Commands/runtime/head recorded in `harness/build/008-fresh-check.txt`. Build 008
  adds acceptance tooling/CI/docs; core executable code is unchanged from that head.
- DOOM independent code reviewer `/root/doom_code_review` reviewed all three
  initial commits and signed `618e79eed3a3299f8931a2d1960a9c0128908437`, with a
  nonblocking P3 finding: manual Refresh loses keyboard focus during rerender.
  Report: https://github.com/talaniz/doom-control/pull/14#issuecomment-5754850277.
  Main accepted it. Contract: retain focus after refresh unless the user moves it
  while waiting. Regression failed before fix, then passed with focus-away coverage;
  28 DOOM tests and actual Chromium focus assertion passed. Fix commit
  `28d4253ca16ba24634418826a19d088a371e74c3`; screenshots recaptured, real PM CLI
  integration rerun passed. Re-review and separate E2E review remain required.
- Primary Build 008 commit will collect acceptance tooling, workflow, evidence index
  and this log. CI must run after publication; independent PM code/E2E reviews,
  DOOM final reviews, release notes and final-head revalidation remain outstanding.
  This is not a claim of completed MVA delivery or permission to merge/deploy.

### Build 008 CI prerequisite correction (Fixes-Build: 008)

The first GitHub run at `f0619de` failed:
https://github.com/talaniz/prime-mover/actions/runs/35557127129.
All 77 unit tests passed; 9 isolated-verification integration paths failed (190/199
passed). A command expected to exit 17 instead returned null, and successful
sandbox commands returned failed. The workflow omitted installation/probing of
`/usr/bin/bwrap`, although those tests deliberately use the real verification sandbox.
The Pi had this prerequisite, explaining the local/CI environment mismatch; detailed
runner diagnostics were not emitted by the initial assertions, so no deeper kernel
failure is claimed as verified.

Acceptance: provision the documented sandbox on the ephemeral CI runner, prove its
namespaces before tests, and pass the unchanged test suite without weakening isolation
or skipping failures. Switched the runner to Ubuntu 22.04, installed Bubblewrap and
added an explicit fail-fast namespace probe. Documented the Linux/Git/Bubblewrap
fresh-checkout prerequisites. The original failed run is preserved; the next GitHub
run must prove green. No Pi package, kernel, permission or service settings changed.

### Independent Prime Mover code-review findings and fixes

Reviewer `/root/pm_code_review` inspected all eight primary commits and aggregate
implementation at `f0619de2d703b0115c60709dca81df8c08ff9260` and posted four P2
findings, without sign-off:
https://github.com/talaniz/prime-mover/pull/3#issuecomment-5754966873.
All four are accepted within scope.

- **PM-CR-1 — pending review visibility:** acceptance requires a published job to
  remain visible with its exact stage/PR while ownership is released between
  implementation and reviews. The Store-transition regression failed before the
  fix (activeJob null after finishImplementation), then passed. Metadata now prefers
  an actual lease/turn holder and otherwise shows pending execution/review stages;
  queued and terminal jobs retain their separate queue/outcome meanings.
- **PM-CR-2 — stale socket:** acceptance requires SIGKILL→restart to recover an owned
  stale socket, simultaneous starts to leave one listener, and active listeners,
  regular files and symlinks to be preserved. Extracted the existing bind behavior
  unchanged into a listener helper; the crash/restart regression then failed with
  zero successful replacements. An initial unused-import TypeScript diagnostic was
  corrected before repeating meaningful red (`008-review-socket-red2.txt`).
  Added an owner-private adjacent flock held by the parent open file description,
  automatically released on death. Only a refused connection plus matching socket
  inode permits stale unlink. CLI checks mount descendants for both socket and lock.
  Five actual-process/socket tests pass, including concurrent restart and foreign
  active listener/lock symlink refusal. Actual CLI on a disposable verified-volume
  runtime passed SIGKILL/stale-path/restart/authenticated-two-defaults acceptance:
  `harness/build/008-live-metadata-restart.txt`. No execution jobs started.
- **PM-CR-3 — CI sandbox:** addressed by `6e4a7252aa705e31f16559f592fb402b3f6bab0a`.
  Actual GitHub run **passed** after installing/probing Bubblewrap:
  https://github.com/talaniz/prime-mover/actions/runs/35557469037.
  The initial failed run remains recorded. No verification fallback or skip added.
- **PM-CR-4 — RPC test timing:** reviewer reproduced a normal disconnect losing a
  race to the fixture's universal 100 ms timeout under load. Positive/disconnect
  fixtures now use a bounded five-second allowance; only the intentional timeout
  scenario uses 100 ms and still asserts one send/no retry. Production RPC timing
  is unchanged. Focused protocol tests pass.

`npm run check` after the product fixes: **291 passed** (77 unit, 205 integration,
9 CLI E2E), strict TypeScript; `harness/build/008-review-fixes-check.txt`. Focused
metadata/socket/RPC checks are repeated after final descendant-guard wiring.
Service/architecture docs describe lock lifetime and recovery rather than the old
unimplemented stale-socket plan. Same-reviewer revalidation and new-head CI are
required before independent PM E2E review starts.

DOOM code sign-off at `4aacb601a8e158aa9310b8c62fd8a2c0464f70e7`:
https://github.com/talaniz/doom-control/pull/14#issuecomment-5754932075.
Distinct DOOM E2E reviewer `/root/doom_e2e_review` independently exercised Chromium,
security/logout probes, actual PM CLI integration, all 28 tests and inspected all 14
screenshots, then signed the same DOOM head:
https://github.com/talaniz/doom-control/pull/14#issuecomment-5754967872.
Its tested PM head was `f0619de`; changed PM metadata requires affected paired-head
integration and review revalidation before final MVA readiness.


## MVA independent product review completion and release notes

Reviewed implementation: `de3c39f6bf8597ad7a468a49f44b5af7ad23e7f7` on
[Prime Mover PR #3](https://github.com/talaniz/prime-mover/pull/3).
Code reviewer `/root/pm_code_review` revalidated all four accepted findings and
posted [SIGN-OFF](https://github.com/talaniz/prime-mover/pull/3#issuecomment-5755058371).
Its fresh clone passed strict TypeScript and **291 tests** (77 unit, 205 integration,
9 CLI E2E); [exact-head CI passed](https://github.com/talaniz/prime-mover/actions/runs/35558077103).
Separate reviewer `/root/pm_e2e_review` received the checked-in role instructions
verbatim as the named-role fallback, verified code sign-off first, and posted
[product E2E SIGN-OFF](https://github.com/talaniz/prime-mover/pull/3#issuecomment-5755177041).
No blocking finding remains on this implementation head.

### Independent actual workflow evidence

The reviewer used the real Pi, Node 22.23.2/npm 10.9.8, Codex 0.155.1 app server,
GitHub and verified external ext4 volume. Its fresh fixture issue #12 produced
[draft PR #13](https://github.com/talaniz/prime-mover-fixture/pull/13), job
`0d69d8a3-d019-4a03-b293-37d4b2250c89`. Active implementation ownership made competing
recovery return busy and intake refuse execution. The deliberate whitespace defect
and weakened tests produced [two independent findings](https://github.com/talaniz/prime-mover-fixture/pull/13#issuecomment-5755094989),
[accepted contracts](https://github.com/talaniz/prime-mover-fixture/pull/13#issuecomment-5755098185),
[verified correction](https://github.com/talaniz/prime-mover-fixture/pull/13#issuecomment-5755104375),
and [same-reviewer sign-off](https://github.com/talaniz/prime-mover-fixture/pull/13#issuecomment-5755112152)
at `1941cb09c05c45bffbdb654d9b4fe7cee1bb8bda`, base
`eee4090de3540b66a25e2ee9195ada3bbec68f00`.

Implementer task `01a0c20d-e096-7fc2-91c4-894e9a524458`, code reviewer task
`01a0c20f-83d5-7b43-93c9-e6c317a797e1`, and E2E reviewer task
`01a0c213-1100-7622-95b4-ad522c7cedb0` are distinct. The latter exercised actual
normal/trimmed/internal-whitespace inputs, invalid-input rejection and regression
sensitivity, then [signed the same head](https://github.com/talaniz/prime-mover-fixture/pull/13#issuecomment-5755123183).

The first readiness attempt safely blocked with `readiness-check-failed` and no
notification. Later diagnostics found valid evidence; the generic blocker did not
retain the original exception cause. No assumed GitHub transient is claimed.
Documented continuation recovered with the same six turn IDs and original deadline.
The observation-only final acceptance passed role independence, direct valid/invalid
behavior, exact remote head/base and [one notification](https://github.com/talaniz/prime-mover-fixture/pull/13#issuecomment-5755138367).
A deliberately failing GitHub status revoked readiness; restored success plus
reconciliation returned ready with **zero new turns**, unchanged deadline
`1789983680443` and the same notification. No reproducible product defect remained.
The initial failure and successful recovery are both preserved in the review report.

A separate independent crash fixture issue #14/job
`2be84b81-443e-45ec-b58b-ea6b77f30dd9` killed its actual worker with SIGKILL after
acceptance. Recovery advanced lease epoch **1→2**, preserving task
`01a0c219-3ecb-7bc3-b8c2-d39742d7cffb`, turn
`01a0c219-3f96-7c73-b801-dac84dec4a27`, task/turn intents and execution-budget record.
It verified the original output and published [draft PR #15](https://github.com/talaniz/prime-mover-fixture/pull/15)
at `98c977dcfcd8ceddcfbea1dcd62439b3fac0e7b9`. This is crash-recovery evidence only;
PR #15 did not run its own review/readiness stages. An earlier harness invocation
refused a still-visible prior authorization before creating any runtime/issue; the
reviewer checked the exact endpoint empty and absence of new work before retrying
with a new receipt. This failure remains recorded.

Actual operator rehearsal passed doctor/no execution-state creation, persistent
pause/resume, cancel, blocked retry, redacted inspect, authenticated private Unix
metadata/two defaults and wrong-volume refusal. During active work, SQLite backup
captured schema 2 (1 job, 11 operations, 35 events), SHA-256
`301a47f9415e1a9f00256689ab15b3083a2b81bd670cbe1b2289adf9c29a06ac`.
The isolated restore was paused, with independently identical jobs/operations.
Overwrite refusal exited 1 and preserved the existing snapshot hash. Actual
service-preflight rejected the missing memory controller; it did not certify
unenforced caps. No production environment, boot settings or shared daemon changed.

Owned fixture issues #10, #12 and #14 were subsequently deauthorized and their jobs
cancelled. PRs #11/#13/#15 and evidence remain draft/unmerged and historical. Earlier
receipts report their observed readiness at the time, not current authorization.
Raw/private receipts remain under ignored `harness/build/e2e-review-*`; decisive
redacted results and remote identities are durably recorded in the product E2E report.

### Dashboard and paired-head closure

DOOM remains at `4aacb601a8e158aa9310b8c62fd8a2c0464f70e7`, with 28 passing tests,
14 inspected desktop/mobile screenshots, separate code/E2E sign-offs linked above.
[Current paired-head E2E sign-off](https://github.com/talaniz/doom-control/pull/14#issuecomment-5755074318)
adds actual PM CLI→authenticated DOOM→Chromium proof at PM `de3c39f` and DOOM
`4aacb60`, including released `pr-open` visibility after metadata SIGKILL/restart.
The unchanged execution-state digest was
`bee2d1ee504249f2e869e3ec092f9e03bd5a71d2e3b77239b0b904e7f92b03c3`.
Both default identities, same-number repository isolation, global contention,
paused/queued/outcome/blocker state, auth/method/unknown-ID denial and stale source
behavior with usable tasks passed. No deployed DOOM files changed.

### Release-note action and final gate

After both independent implementation reviews passed and the main task confirmed
no unresolved blockers, generated `harness/release-notes/mva.md` from this log and
verified PR evidence. Updated stale aggregate status summaries and the acceptance
index; historical build/failure entries and original receipts remain intact.
This separate commit changes documentation only, with no new primary Build trailer.
Structural checks passed for all 24 Markdown files' local links, reviewer TOML
parsing, eight unique primary Build trailers, diff whitespace, credential patterns
and the eight documentation-only changed files. No artificial
failing application test or unrelated local application rerun is required.

Both PM reviewers must now revalidate the final documentation SHA on PR #3, and
DOOM's independent reviewer must assess the final paired-head documentation delta.
Final CI and exact-head sign-offs are recorded on the PRs before draft removal;
this avoids recursive sign-off-only commits. Those PR records are authoritative
for final delivery status. Owner approval remains required for merge/deployment.
Persistent boot mounting, kernel memory-controller enablement/reboot and actual
memory-limit enforcement remain unperformed deployment prerequisites.


### Final remote verification correction

The final GitHub PR query verified DOOM does have a configured Tests workflow and
[passing exact-head CI](https://github.com/talaniz/doom-control/actions/runs/35556930007)
at `4aacb601a8e158aa9310b8c62fd8a2c0464f70e7`. The release-note sentence claiming
no configured DOOM CI was incorrect and is corrected here. Actual browser checks
remain distinct evidence. Both PRs had briefly been marked ready after the prior
sign-offs; PM was returned to draft for this two-file documentation correction.
No executable changes or application reruns are needed. Final reviewers must
revalidate the new documentation SHA; the PR records remain authoritative. Diff
whitespace and local documentation-link checks pass.

## Live issue publication recovery — 2026-09-21

User authorizes focused fixes, targeted worker deployment/restarts and supported recovery until a real issue reaches a worker-published implementation PR. No UI merge/deployment is authorized. Acceptance: distinguish base drift, retain guards and all completed work/budgets, and demonstrate actual automated publication for DOOM #16.

Generation 0 (`821e7d0a-1c6a-4549-90fa-a0f28ee2fc9b`) was acknowledged, implemented as `37a87aaa42cc0baee92c3f338c4b62c901ff2624`, and passed both configured commands. Authoritative thread/read confirms its exact turn completed. DOOM main advanced from `79e139e` to `643911a` during execution, before the publication guard. No push/PR intent exists. The guard was correct but the generic implementation-error hid its cause.

Regression red: `npm run build && node --test --test-name-pattern='base drift' test/integration/implementation.test.mjs` exited 1: actual implementation-error, expected base-branch-changed. Fix throws the existing typed ExecutionBlocked and documents cancellation/rerun with retained prior evidence and budgets. Green: both affected integration suites pass 16/16; whitespace passes. No refactor needed. Full checks/reviews and live recovery evidence follow; publication success is not yet claimed.

Full `npm run check` passed: strict TypeScript, 77 unit, 206 integration and 9 CLI E2E tests (292 total), zero failures. This is regression coverage, not evidence that the real issue has published yet.
