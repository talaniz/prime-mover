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
