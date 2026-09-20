# Prime Mover execution log

## Authority and current state

This is the source of truth for actual execution and release-note generation, backed
by Git and linked verification/review evidence. Plans are not accomplishments.
Application milestone: **Minimum Viable Application**. Status: **not started**.
Builds 001–008: **pending**. No worker, polling, database, review engine, or notifications
are implemented. This branch prepares the harness only.

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
