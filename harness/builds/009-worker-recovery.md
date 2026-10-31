# Build 009 — Worker compatibility and outcome recovery

Authorization: owner approved the October 31 recovery plan. One recovery branch/PR,
base `1a92b89fecf2798fa5242e7a5b8900467c07b821`, isolated worktree
`/home/palpatine/prime-mover-recovery`. Implementation, isolated tests, commits and PR
reviews are authorized. Production activation, shared-daemon restart, merge, issue
label changes and production database updates remain separate from this build.

## Acceptance

- Validate configured, installed and connected Codex versions against explicitly
  accepted versions; reject unknown/mismatched evidence before task execution.
  Validate 0.162.0 with an isolated task lifecycle trial; preserve approval and
  sandbox policy, bounded observation and no automatic ambiguous-turn retry.
- Observe merged/closed PR outcomes before open-PR readiness. Reconcile existing
  ready and readiness-blocked jobs using fresh, repository/PR/head/base-branch-bound
  remote evidence. Preserve history, budgets and notifications; never merge a PR.
- Require no active lease, turn or pending operation, use atomic conditional local
  transitions, and make repeated reconciliation idempotent. Unavailable or malformed
  remote evidence must not complete work or trigger replacement execution.
- Preserve genuine conflicts and changed-head blockers. Do not require obsolete base
  SHA, mergeability or current issue execution authorization to record an already
  completed remote outcome. Require recorded ownership and reviewed head evidence.
- Run outcome reconciliation while intake is paused; avoid re-ingesting terminal
  generations merely because an issue remains open and labeled codex-ready.
- Provide an operator command for bounded outcome-only reconciliation with no
  app-server/task/publication side effects, plus dry-run preview before application.
- Preserve metadata visibility of genuine remaining blockers even after newer jobs
  complete. No DOOM UI code changes or production service modifications.
- Document one shared-daemon owner, no competing app-server startup, exact backup /
  isolated restore / rollback / paused activation / canary gates and resource limits.

## Verification contract

Write meaningful failing fixture tests before implementation: merged readiness-blocked
job, repeat reconciliation, same-repo/head checks, closed/open/conflicted PRs, stale or
invalid evidence, active reservations, remote failure and duplicate intake. Validate
metadata and paused worker ordering. Version tests cover supported and mismatched
CLI/config/server identities. Run `npm run check`, isolated CLI workflows and a bounded
live synthetic app-server probe without restarting shared services. Full production
recovery and canary remain deployment acceptance, not claimed by fixture tests.

Independent code review precedes distinct E2E review; both must sign final head.
Release notes follow verified evidence. No rendered UI change: screenshots N/A;
metadata JSON changes require actual endpoint checks. Failures and limits remain
explicit. New executable delivery is one primary commit with `Build: 009`.
