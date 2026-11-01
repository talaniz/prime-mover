# Worker recovery — release notes

[PR #9](https://github.com/talaniz/prime-mover/pull/9) prepares Prime Mover for
controlled recovery after a Codex version change. Implementation is reviewed at
`99f7be0c3eae16e515afc19d9d03770fb6ea3d43`; this is not production activation.
The [execution log](../execution-log.md) records checks and limitations.

## Delivered behavior

- Explicit support for Codex 0.155.1 and 0.162.0, requiring matching configured,
  installed and connected-server versions before execution.
- Fresh, identity-bound merged/closed PR observations recorded as durable terminal
  outcomes for previously ready or readiness-blocked jobs. Repeated reconciliation
  is idempotent, preserving operations, budgets, notifications and history.
- Read-only outcome preview and paused-only application through `reconcile-outcomes`.
  Active reservations and pending work refuse completion; uncertain remote evidence
  stops the worker cycle. Applying failed observations revokes idle stale readiness.
- Remaining blockers stay visible in metadata after newer work completes. Terminal
  generations are not re-ingested merely because an issue remains open and labeled.
- A [deployment and rollback runbook](../../docs/worker-recovery.md) covers shared
  daemon ownership, fresh backup/restore, paused activation and a bounded canary.

## Verification and reviews

[Independent code sign-off](https://github.com/talaniz/prime-mover/pull/9#issuecomment-6552886082)
and [separate E2E sign-off](https://github.com/talaniz/prime-mover/pull/9#issuecomment-6552908744)
cover the implementation SHA above. One code-review finding was corrected: failed
outcome checks could leave a stale ready state before normal readiness rechecking.
Observed regression failures preceded the fix; independent code review then passed
lint, build and 21 focused tests. E2E independently passed 11 actual CLI/HTTP/intake
scenarios, including read-only preview, paused application/replay, failed evidence,
reservation refusal, duplicate prevention and authenticated metadata with an older
blocker alongside a newer merged outcome (unauthorized 401, writes 405).

The initial implementation passed strict TypeScript and all 323 tests serially.
Default parallel local execution hit one existing fixture lease timeout under Pi
contention; that test passed alone and in the full serial run. Required GitHub
`npm run check` passed on both the initial implementation and corrected implementation.
Final documentation-head CI and both exact-head revalidations are recorded on the PR.
No rendered UI code changed; screenshots are not applicable.

[Redacted live and copy evidence](../evidence/worker-recovery.json) records Codex
0.162.0 task completion, history, reconnect/resume and interruption, with unchanged
approval/sandbox policy. Initial RPC errors and recovery using the same saved IDs
are disclosed; no root cause is inferred. Candidate service preflight passed with
private configuration. A consistent production snapshot was restored and reconciled
in isolation using fresh GitHub reads: PR19/23 became merged, PR17 stayed blocked,
repeat observations caused no duplicate outcomes, and operations/notifications were
unchanged. Read-only production preview passed after an initial remote-read failure.
The E2E reviewer inspected these live artifacts rather than launching new live tasks.

## Remaining human actions and limits

Merge and deployment require separate authorization. Production services, configuration
and ledger were not changed; the failed worker has not been restarted by this work.
No shared-daemon restart, production canary, unattended-operation acceptance or full
production rollout is claimed. The rehearsal snapshot does not replace a fresh
pre-deployment backup and verified isolated restore. Follow the runbook to stage the
reviewed release, reconcile while paused, verify metadata, activate under observation
and authorize one bounded canary. Existing genuine conflicts remain operator work.
Rolling back to the old version pin restores the known stopped state, not a working
executor. Final notes-only review confirmations live on the PR to avoid recursive
sign-off commits.
