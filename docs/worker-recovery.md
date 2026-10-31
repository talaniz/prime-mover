# Worker recovery and controlled activation

Build 009 repairs compatibility checking and records remote PR outcomes separately
from open-PR readiness. It never merges, closes, edits or comments on GitHub PRs.
A `merged` outcome records observed delivery, not deployment or human acceptance.
The ready event and reviewed head must already exist locally; remote repository,
PR number, head and target branch must agree. Base SHA/mergeability naturally change
at merge and are not terminal-outcome requirements. Changed heads and uncertain
identity stay unresolved. Only ready and readiness-check-failed jobs are candidates;
other historical blockers require individual investigation. Closed means closed
without merge, not successfully delivered.

## Version and daemon ownership

Accepted versions are 0.155.1 and 0.162.0; configure `appServer.version` to the installed
and connected version. Unknown versions, CLI/config mismatch, or connected-server
mismatch fail before execution. This is a tested-version list, not a promise that
future releases are compatible. Re-run lifecycle acceptance before extending it.

One owner must manage the shared daemon. Do not start the obsolete
`codex-app-server.service` while a daemon already owns its socket. The example worker
unit intentionally has no Wants/Requires dependency that starts that service. Remove
such locally added dependencies from the candidate worker unit at deployment after
checking all drop-ins. Use the existing socket; preflight checks its connectivity.
Do not remove sockets, kill processes, update Codex or restart the shared daemon to
make preflight pass. Arrange a separate maintenance window if daemon ownership must
change, with active sessions and remote-phone access accounted for.

## Preview and apply

From a built reviewed release:

```sh
node dist/cli.js reconcile-outcomes /path/to/config.json
node dist/cli.js reconcile-outcomes /path/to/config.json JOB_ID
# After inspecting preview, pausing intake, and establishing deployment authority:
node dist/cli.js reconcile-outcomes /path/to/config.json --apply
```

Preview opens the existing schema-2 database read-only; it does not seed projects,
migrate state or connect to Codex. Apply requires paused intake, refetches remote
state and atomically commits each job's outcome/audit event. Repeated application
is a no-op for already terminal jobs. `--apply JOB_ID` explicitly verifies one
previously ready or terminal job. No leases, turns, budgets, operations or existing
notifications are reset. Active/pending reservations and incomplete notifications
refuse completion. A batch may record earlier jobs before a later lookup fails;
inspect the ledger and rerun safely after resolving the failure. Do not restore an
old database to undo partial observations without reconciling external state.

The supervised cycle also reconciles outcomes after reservation recovery and before
readiness/polling, including while intake is paused. Uncertain outcome evidence
halts that cycle before intake or new execution. Discovery reuses an existing
terminal generation even when its issue remains open and labeled; a new generation
requires the explicit existing rerun flow.

## Deployment gates (not performed by this change)

1. Confirm final code/E2E sign-offs, passing CI, merge and explicit deployment
   authority. Record current unit/config/release paths and inspect drop-ins, socket
   owner, loaded sessions, disk/memory pressure and current GitHub outcomes again.
2. Keep the worker stopped. Pause intake through the supported operator command;
   save owner-only config/unit copies and a fresh SQLite-consistent backup using
   `backup CONFIG ABSOLUTE_BACKUP` under the configured root's `backups/` directory.
   Run `restore-check CONFIG BACKUP ISOLATED_OUTPUT` under `restores/`; verify
   schema/integrity, paused status, job/operation/event counts and hashes. The private
   development rehearsal snapshot is evidence, not a substitute for this fresh backup.
   Preserve worktrees, artifacts and credentials separately; DB backup excludes them.
3. Stage immutable candidate worker and metadata releases. Update candidate config's
   accepted version only after matching CLI/server identities. Validate candidate
   unit files, including memory/process limits and mount conditions. Do not activate
   a competing app-server unit. Run doctor and service-preflight before switching.
4. Preview outcomes, review exact job/PR/head evidence, then apply while paused.
   For the diagnosed snapshot, PR19 and PR23 should become merged, PR17 should remain
   readiness-blocked (conflicted), and the cancelled generation should stay cancelled.
   Verify append-only outcome events and unchanged operations/budgets/notifications.
5. Activate the candidate metadata service and check authenticated/unauthenticated
   endpoints and DOOM Projects integration. Worker and metadata must read schema2;
   the new metadata release preserves older unresolved blockers alongside newer
   outcomes. Restarting metadata may briefly affect Projects availability but must
   not interrupt DOOM tasks or the shared Codex server.
6. Start the candidate worker with intake still paused. Verify no new turns or
   publications, bounded resource usage, persisted outcomes and clean repeated
   cycles. Set an observation window and stop on unexpected job/turn creation.
7. Explicitly authorize one bounded canary issue, resume intake, and verify intake →
   implementation → distinct code/E2E reviews → readiness. Human merge remains
   separate. After a human-authorized merge, verify one durable merged outcome with
   no duplicate execution/comment. Only then accept unattended operation.

Rollback: stop the candidate worker before changing releases; leave intake paused.
Preserve new evidence and back up the current ledger. This change keeps schema2;
prefer rolling back worker/metadata binaries over replacing the database. Old worker
0.155.1 pin still rejects current Codex, so rollback restores the known stopped state,
not a working executor. Never downgrade/restart the shared daemon as an implicit
rollback. Database restoration is a separate reconciled operator procedure.
