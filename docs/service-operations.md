# Service operations (Build 007)

Production activation requires owner approval after milestone review. The checked-in
`deploy/prime-mover-worker.service` and `deploy/prime-mover-metadata.service` are user
service templates for this Pi, not installed units. Verify paths, credentials, resource
limits and the existing app-server protocol before activation. The worker's service
preflight probes storage, credentials and the actual app-server connection. It never
starts or restarts the shared app-server daemon.

The worker supervisor runs sequential `cycle` processes, opening a fresh app-server
connection each time. `pollSeconds` controls the interval. Consecutive failed cycles
are limited by `limits.transportAttempts`; exhausting them exits nonzero. Systemd
additionally limits restart bursts. Job deadlines and transport/recovery budgets remain
in SQLite across process and service restarts. There is no concurrent cycle execution.

For a finite supervised rehearsal, use the existing private configuration:

```sh
node scripts/worker-service.mjs CONFIG_PATH 2
```

SIGTERM/SIGINT wakes the supervisor's interval wait or forwards shutdown to its active
cycle. The cycle aborts new execution and observes/interrupts its owned turn; it does not
clear an uncertain reservation. After 45 seconds the supervisor may force its child
process group to exit; systemd's 60-second timeout bounds the whole service shutdown.
A forced exit is not remote-stop proof. Inspect the job and reconcile it on restart.
An interrupted model turn can remain blocked for explicit operator handling.

The metadata service is independent so a worker failure can remain visible. Keep its
socket and token private; expose the read-only API only through the authenticated DOOM
integration. Neither service has a merge or deployment action.

## Persistent external storage

The current external filesystem UUID is recorded in the execution log and must match
`storage.uuid`. Runtime state stays under `/media/talaniz/postgresdata/codex-work`.
The volume currently uses a desktop-managed mount; persistent boot mounting is not yet
installed/proven. Before approved deployment, arrange a system-managed UUID mount at
the same path, preserving PostgreSQL/n8n and all existing data. Inspect existing mounts
and fstab first; do not reformat, unmount an in-use volume, or create a competing mount.

Both templates require the external mount path and refuse a root-filesystem directory
masquerading as the mount. Each cycle also verifies UUID, ext4, writability and free
space. If the volume was absent when the unit was started, verify it after attachment
and explicitly start the unit again; a skipped mount condition is not a successful
worker start. Persistent mount installation and actual boot acceptance remain gates.

## Limits and recovery

Worker templates cap memory at 1 GiB (high watermark 512 MiB), CPU at one core and
processes at 256. Metadata is capped at 256 MiB and 32 processes. These are initial Pi
limits and require supervised workload validation; an OOM kill or task cap is a failure,
not a successful verification. Do not raise limits merely to hide a runaway job.

Use the backup/restore procedures in `recovery.md`. Preserve worktrees, command artifacts,
configuration and credentials separately from database snapshots. Never run a restored
worker alongside the source. Retain blocked/active work and uncertain intents; automatic
artifact/backup deletion is not enabled. Capacity preflight blocks work before the disk
reserve is consumed. Review retention and tested upgrade/rollback procedures before
production activation.

## Retention and capacity response

Retain the SQLite ledger and append-only events for the lifetime of the installation;
there is no automatic ledger pruning. Keep every active, blocked or uncertain job's
worktree, repository references and command artifacts. Ready jobs remain retained until
their remote result is terminal and the operator has confirmed that review evidence and
rollback needs are satisfied. Never use age alone to delete a job's dependencies.

Keep at least the last three verified database snapshots and one snapshot from before
any upgrade. Store copies on a separate protected medium so loss of this external disk
does not also destroy the only backup. Receipts and snapshots are private. Snapshot
rotation is a deliberate operator action after integrity/restore checks; no cleanup
process is enabled by the templates. Before removing old snapshots, verify that the
retained snapshots cover those rules and that no restore/review is using them.

On a disk reserve or memory preflight failure, pause intake, inspect `status`, `inspect`
and service logs, and identify the actual pressure. The memory reserve is 256 MiB of
Linux `MemAvailable`, excluding swap. Do not delete WAL/SHM files, clear pending intents,
kill unrelated services, or reset budgets to regain capacity. Archive verified inactive
artifacts to separate storage only after checking their references. If capacity cannot
be recovered safely, leave the worker stopped and report the blocker.

## Upgrade and rollback procedure

1. Record the running code SHA, configuration schema and database schema. Pause intake
   and stop the worker; keep metadata available for inspection if storage is healthy.
   Confirm owned remote tasks have ended. A stopped process alone is insufficient.
2. Preserve the current checkout/release and private configuration. Create and verify a
   SQLite snapshot with `backup`; validate an isolated copy with `restore-check`. Preserve
   the corresponding worktrees, artifacts and repository references at their recorded
   paths while no worker/model task can modify them. Securely back up credentials using
   the host's credential procedure; do not add them to repository archives or logs.
3. Build the reviewed candidate in a separate checkout, run its required checks, and run
   read-only `doctor` against the intended configuration. Validate schema compatibility
   and the candidate's behavior against the isolated paused restore. Never let that copy
   execute while the original runtime exists. Do not enable unattended startup yet.
4. After owner approval, select the candidate service paths, start metadata/worker and
   observe a supervised cycle. Confirm project registry, pending ownership, budgets and
   readiness are preserved. Resume intake only after those checks pass.
5. On failure, stop the candidate and reconcile any remote actions it may have accepted.
   If the previous code supports the current schema, return to that release without
   replacing the ledger. Otherwise restore only a verified compatible snapshot into a
   new isolated location, preserving the failed runtime. Reconcile all actions since
   that snapshot before replacing production state. Never overwrite a live database,
   copy an old ledger over newer accepted work, or run two workers to compare releases.

These are required operator procedures, not a claim that production upgrade/rollback
or persistent boot mounting has been exercised. The execution log identifies completed
rehearsals and remaining acceptance gaps.

## Deployment prerequisite discovered on this Pi

The current kernel command line includes **`cgroup_disable=memory`**. The cgroup v2
controller list lacks `memory`, so accepting a systemd `MemoryMax` property does not
mean the limit is enforced. The worker template now runs `service-preflight`, which
rejects this condition before credentials or execution are used. The metadata template
also checks for the controller. Ordinary `doctor` and finite supervised CLI rehearsals
remain available for diagnostics; they do not authorize unattended activation.

During the separately approved deployment window, review the actual boot configuration,
remove the memory-disabling flag without disturbing other boot arguments, and schedule
a reboot that accounts for DOOM/PostgreSQL/n8n. After reboot, verify `memory` appears in
`/sys/fs/cgroup/cgroup.controllers` and that each service's actual cgroup has the intended
finite `memory.max` value; then rerun `service-preflight` and the capped workload. Do not
claim hard memory-limit validation before that evidence exists. No boot change or reboot
has been performed by this implementation task.

`deploy/fstab.example` contains the proposed UUID mount entry for this Pi. It is an
entry to review alongside the existing fstab, never a replacement for the whole file.
Privileged read-only `findmnt --verify` validated the UUID, device and ext4 type with no
errors or warnings. The example is not installed, and validation is not proof of a
physical reboot. Mount installation, boot verification and the memory-controller change
remain deployment prerequisites requiring the owner's planned approval.

## Metadata listener crash recovery

Metadata startup uses `/usr/bin/flock` from util-linux (also the provider of the
required `findmnt`). An adjacent mode-0600 `.lock` file persists; the kernel lock
is held only while the listener process is alive. Do not remove that file while
any metadata listener might be running. After SIGKILL, startup takes the lock,
confirms an existing owned socket refuses connections, rechecks its inode, removes
that stale socket and binds a new mode-0600 endpoint. Concurrent starts cannot
replace each other's listener. A regular file, symlink, foreign/active listener or
uncertain probe is preserved and startup fails for operator investigation. No PID
file or elapsed-time assumption is used to prove a listener has stopped.

Jobs waiting between implementation and review remain visible as active work even
after the execution lease has been released; the displayed stage identifies that
handoff. This display does not reserve a new execution turn.
