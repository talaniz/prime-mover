# Recovery and operator contract

Build 007 implementation and supervised acceptance are complete. This matrix defines
startup behavior; its evidence table distinguishes fault fixtures from live rehearsals.
The execution log records actual checks and deployment prerequisites. Production
activation remains subject to owner approval.

Before intake, inspect every nonterminal job, lease, recorded task/turn and pending
operation/outbox item. Adopt only an expired local lease, increment its epoch and retain
all remote identities and intent payloads. Adoption permits reconciliation; it is not
proof that an external action ended. Refresh authorization before resuming work.
Execution deadlines and recovery/correction budgets must survive adoption and restart.

| Boundary or condition | Required reconciliation | Forbidden shortcut |
| --- | --- | --- |
| Live, unexpired worker lease | Leave ownership with that worker | Steal its lease or start another job |
| Expired lease, recorded active turn | Fence the old worker, retain task/turn, inspect and observe that exact run | Clear the reservation and launch a replacement |
| Lost thread-start response | Correlate a unique recorded source and cwd; retain ambiguity when absent or duplicated | Repeat thread/start because lookup failed |
| Lost turn-start response | Correlate the persisted client message identity in full owned-task history | Repeat turn/start after an uncertain response |
| Cancellation or expired deadline | Use observation authority to stop the exact owned turn; wait for terminal proof | Reset the budget or interrupt an unrelated task |
| Pending approval | Keep the owned task visible and bounded; observe or await operator action | Treat an unavailable approval as successful execution |
| App-server unavailable or history incomplete | Persist an actionable blocker and preserve identities | Infer idle from a disconnect or missing page |
| Worker died before first external intent | Establish the initial execution budget from persisted claim evidence, then continue once | Reset an already recorded deadline |
| Setup/verification intent lacks matching artifact | Block pending command reconciliation | Rerun an unknown command or invent passing output |
| Commit/push result uncertain | Verify the recorded parent/tree/message and actual remote branch | Amend, force-push or create replacement history |
| PR/comment POST response uncertain | Recover one exact owned marker/body/author/branch match | Send another POST when absence is still ambiguous |
| Code/E2E correction interrupted | Resume its original intent and role; code re-review precedes E2E revalidation | Reuse stale sign-off or substitute another role's identity |
| Ready head/base/check state changes | Revoke readiness; require current evidence and matching reviews | Keep a stale ready result or send duplicate readiness comments |
| Issue authorization withdrawn or contract changed | Stop owned work, retain contract invalidation and require reconciliation | Publish earlier work under the changed contract |
| Missing/read-only/full external storage | Fail before creating runtime paths; retain existing ownership evidence | Create fallback state on the Pi root filesystem |
| Restored database | Validate integrity and preserved records; leave the isolated copy paused | Start it concurrently with the source worker |

The implemented lease and app-server primitives preserve active reservations, correlate
lost responses without new task/turn sends, and permit cancellation-only observation.
Their tests include `recovery-lease.test.mjs`, `execution-agent.test.mjs` and
`startup-recovery.test.mjs`. The integrated CLI/supervisor and live worker-crash proof
are recorded below and in the execution log.

## Database snapshots and isolated restore validation

Use an already verified configuration and new paths below its runtime root:

```sh
node dist/cli.js backup CONFIG_PATH RUNTIME_ROOT/backups/snapshot.sqlite
node dist/cli.js restore-check CONFIG_PATH RUNTIME_ROOT/backups/snapshot.sqlite RUNTIME_ROOT/restores/check/jobs.sqlite
```

These commands verify the configured external mount and storage reserve before writing.
They refuse existing destinations, symlinks and live-database sidecars. The snapshot is
mode 0600, SQLite-consistent and checked for schema, integrity and foreign keys. The
receipt contains a SHA-256 and record counts. Restore validation checks a new copy,
pauses it and starts no execution. Keep the backup, its receipt and any raw artifacts
private and out of Git.

This is a **database-only snapshot**. It preserves task IDs, intents, budgets, review
and notification records, including uncertain state; it does not prove remote actions
are idle or copy external worktrees, bare repositories, artifacts, configuration or
credentials. A complete disaster-recovery procedure must also preserve or reconstruct
those dependencies from verified evidence. Do not relocate recorded paths, reset IDs
or run a restored copy merely because its SQLite integrity check passes.

A production restore requires the worker stopped, original files preserved, external
activity reconciled and the intended runtime/configuration verified. Installation and
production replacement are not performed by `restore-check`. Service procedures and
retention rules are in `service-operations.md`; supervised dependency/restart evidence
is recorded in the execution log.

### Startup reconciliation commands

`recover-once CONFIG` observes interrupted ownership and continues the same recorded
workflow when authorization and persisted budgets permit. It never claims a new queued
job. `run-once CONFIG` runs the same reconciliation first and claims a queued job only
when reconciliation reports `clear`. A live lease reports `busy`; ambiguous reservations
remain reserved and block competing execution. The recovery attempt ceiling currently
uses `limits.transportAttempts`; original job and turn deadlines remain authoritative.

These commands are implemented and locally tested. The clear-ledger command has also
been exercised against the completed live fixture without changing its ledger. The live
worker-crash and supervised dependency gates are recorded in the execution log. Host
boot/memory prerequisites still prevent unattended deployment readiness.

Transport read failures consume a persisted per-job allowance, also configured by
`limits.transportAttempts`. Restarting the worker or reopening its database does not
reset that allowance. Exhaustion prevents new execution/task starts; bounded reads
needed to identify and stop an already-owned turn remain available. Ambiguous older
task sends cannot be skipped in favor of a newer task. Resolve the underlying condition
and inspect the ledger; do not erase intents or consumed budgets to force progress.

### Supervised cycles

`cycle CONFIG` runs preflight and startup reconciliation before doing any intake. A
clear ledger permits ready-result revalidation and one pending code/E2E review stage,
or intake followed by one implementation. Each invocation creates a fresh app-server
connection; uncertainty or a live owner prevents competing work. While paused, the
cycle still revalidates ready results but starts no review or implementation.

The actual cycle has run under a temporary user systemd unit against an isolated empty,
paused runtime. A missing app-server socket caused a nonzero exit without jobs or
operations. Additional supervisor/worker-restart and ordering evidence is recorded in the log.
Physical boot verification and service installation remain pending and owner-gated.

## Build 007 fault-boundary evidence

The following maps expected outcomes to executable coverage. Fake transports exercise
failure boundaries; they do not claim a shared live daemon was restarted. Live proof
is identified separately in the execution log.

| Boundary | Observed outcome / executable evidence |
| --- | --- |
| Before task/turn send; lost accepted response | `execution-agent.test.mjs`: correlate source/client ID, paginate history, preserve uncertain intents, no duplicate send |
| Disconnect, RPC timeout, provider error | `app-server.test.mjs`: pending requests reject with redacted errors; writes are not retried |
| Read failures across database reopen | `execution-agent.test.mjs`: durable transport allowance exhausts; stopping owned work remains possible |
| Live owner, expired epoch, competing job | `recovery-lease.test.mjs`, `scheduler.test.mjs`, `startup-recovery.test.mjs`: live owner remains, expired owner is fenced, no competing execution |
| Approval, cancellation, deadline, service shutdown | Adapter/implementation/scheduler tests retain exact ownership until terminal proof, or leave a visible blocked reservation |
| Before first execution intent | Recovery-lease tests reconstruct deadline from original claim time; no restart extension |
| Command result missing after crash | `command-evidence.test.mjs`: missing artifact blocks, matching artifact completes the intent, mismatched artifact cannot acknowledge or rerun the command |
| Local commit or remote push accepted before response | `publication.test.mjs`: recover exact commit/remote head; advanced base and stale verification block |
| PR, acknowledgment or report POST uncertain | Publication/intake/PR-comment tests recover exact identity/body/author; absence or ambiguity does not trigger another POST |
| Correction/review restart stage | `recovery-route.test.mjs` plus review coordinator tests retain the pending correction and require code review after E2E fixes |
| Ready result/check/authorization drift | Readiness tests revoke stale evidence; live fixture check failure/recovery and later label withdrawal are recorded in the log |
| Missing/read-only/wrong/full storage | `storage.test.mjs` rejects before creating fallback runtime state |
| Low/unknown RAM or absent memory controller | `resources.test.mjs` blocks execution/activation with fixed diagnostics; recovery can still stop owned work |
| Active WAL snapshot and isolated restore | Backup integration/CLI tests preserve leases, intents and budgets, reject corruption/overwrite/sidecars; live snapshot/restore proof is in the log |
| Worker process killed during actual model execution | Live fixture #10 recovered epoch 1 to 2 with identical task/turn/deadline, verified output and draft PR #11 |
| Service ordering, unavailable prerequisite, stop | Temporary systemd units prove ordered start and `JOB_RESULT=dependency`; supervisor rehearsals prove sequential cycles and SIGTERM stop |

A systemd launcher exit code alone is not dependency success: the failed-prerequisite
rehearsal returned launcher exit 0 while the authoritative job result was `dependency`.
Use unit/job state and execution evidence together. See the execution log for exact
commands, result counts, IDs, timestamps and artifacts.


## Base branch advanced before publication

`base-branch-changed` means the remote base no longer equals the recorded workspace
base. Publication is blocked before push/PR creation; the completed implementation,
verification artifacts, deadlines and operation history remain intact. Older releases
reported this condition as the generic `implementation-error`. Compare the recorded
workspace base with the remote base and inspect the operations before attributing an
older failure to this condition. Do not suppress the base check or reset the plan.

A same-generation `retry` retains the old base and does not resolve this blocker.
To request fresh execution against current main, first inspect the job and its exact
recorded remote turn. Confirm terminal remote execution, no lease, no active turn,
no pending operation/acknowledgment, and no ambiguous publication. Preserve the old
worktree, commits, artifacts and ledger. Then use the supported operator commands:

```sh
node dist/cli.js cancel CONFIG_PATH JOB_ID "Base advanced; terminal work verified and retained"
node dist/cli.js rerun CONFIG_PATH JOB_ID "Reimplement against current base after reviewed base drift"
```

`rerun` requires a terminal prior generation and fresh issue authorization. It creates
a linked new generation and acknowledgment; it does not rewrite the prior generation,
reset its budgets, reuse its verification, or manually copy its implementation. The
new generation receives the configured execution budget. Do not use rerun to evade
an exhausted budget or unresolved operation. Monitor its actual implementation and
publication; the resulting draft still requires independent reviews. No merge or
application deployment is implied.
