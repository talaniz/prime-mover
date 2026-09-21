# Minimum Viable Application — release notes

Builds 001–008 implement the supervised MVA in [Prime Mover PR #3](https://github.com/talaniz/prime-mover/pull/3), with the read-only Projects page in [DOOM PR #14](https://github.com/talaniz/doom-control/pull/14). This is implementation delivery, not production activation. The [execution log](../execution-log.md) is the source of every result below. Final documentation-head reviews and readiness status are recorded on those PRs; nothing is merged or deployed by these notes.

## Delivered behavior

- Defaults for Prime Mover and DOOM Dashboard, independent project polling and repository attribution, with one active job/agent turn globally.
- Maintainer-authorized issue intake with explicit contracts, durable acknowledgments, edit/revocation handling and visible blockers.
- SQLite jobs, fenced ownership, durable operation intents and immutable execution budgets; isolated external-volume worktrees and sandboxed verification before scoped commit/push/draft-PR publication.
- Independent sequential code and E2E review, public findings/contracts, bounded verified corrections, same-reviewer revalidation and readiness tied to current evidence. One reconciled owner notification; no automatic merge or deployment.
- Interrupted-work reconciliation preserving accepted tasks/turns, operator CLI, storage/resource guards, consistent database backup and paused isolated restore, supervised service templates and operating procedures.
- Authenticated read-only Unix metadata and DOOM Projects list/detail, covering both defaults, progress/queue/outcome/blocker, pause/freshness and loading/empty/stale/unavailable states. Reads leave execution state unchanged. Manual project management is outside this MVA.

## Reviewed implementation and verification

| Product | Reviewed implementation SHA | Independent review evidence |
| --- | --- | --- |
| Prime Mover | `de3c39f6bf8597ad7a468a49f44b5af7ad23e7f7` | [Code sign-off](https://github.com/talaniz/prime-mover/pull/3#issuecomment-5755058371), [separate E2E sign-off](https://github.com/talaniz/prime-mover/pull/3#issuecomment-5755177041) |
| DOOM | `4aacb601a8e158aa9310b8c62fd8a2c0464f70e7` | [Code sign-off](https://github.com/talaniz/doom-control/pull/14#issuecomment-5754932075), [separate E2E sign-off](https://github.com/talaniz/doom-control/pull/14#issuecomment-5754967872), [paired-head revalidation](https://github.com/talaniz/doom-control/pull/14#issuecomment-5755074318) |

Prime Mover strict TypeScript and **291 tests** pass (77 unit, 205 integration, 9 CLI E2E), including an independently verified fresh clone. [Implementation-head CI passed](https://github.com/talaniz/prime-mover/actions/runs/35558077103). DOOM has **28 passing tests**, actual Chromium acceptance and 14 inspected desktop/mobile screenshots. DOOM has no configured GitHub CI; its local/browser evidence is not represented as a CI pass.

The actual paired-head test used PM CLI metadata, authenticated DOOM and Chromium, proving both defaults, repository isolation, global contention, safe read-only access, stale-source behavior and continued task access. The independent reviewer also proved released `pr-open` work stays visible after metadata SIGKILL/restart. The final notes commit changes no executable behavior; final reviewers assess that delta against this evidence.

Independent product E2E created [fixture PR #13](https://github.com/talaniz/prime-mover-fixture/pull/13), deliberately seeded two defects, observed independent findings, original-implementer correction, same-code-reviewer revalidation and a distinct E2E sign-off at `1941cb09c05c45bffbdb654d9b4fe7cee1bb8bda`. It proved one readiness notification and failed-status revocation/recovery with zero new turns or deadline reset. A separate accepted-turn SIGKILL rehearsal recovered the same task/turn and budget, advanced lease epoch 1→2 and published [fixture PR #15](https://github.com/talaniz/prime-mover-fixture/pull/15). PR #15 proves crash recovery only, not its own review/readiness. Operator, wrong-volume, private metadata, backup/paused-restore and overwrite-refusal workflows passed. Detailed IDs/actions are in the product E2E report and execution log.

## Corrections and limitations

Four product code-review findings were accepted and resolved: pending-review metadata visibility, stale socket recovery/concurrent starts, missing CI Bubblewrap provisioning, and an overly short RPC test timeout. DOOM's manual-refresh focus defect was corrected and re-reviewed. Initial failures and red/green evidence remain in the log.

The independent fixture's first readiness attempt safely blocked without notification. Documented continuation recovered with the original six turns and deadline; no reproducible defect remained. The generic blocker did not retain the original exception cause, so no specific transient cause is claimed. Ambiguous remote writes remain blocked until evidence resolves them.

Fixture issues #10, #12 and #14 were deauthorized and cancelled after the rehearsals; their draft PRs and historical receipts remain intact. Recorded readiness is an observed historical result, not current authorization. Production repositories were not used for automatic fixture intake.

Native SQLite is experimental on pinned Node 22.23.2. Runtime state and worktrees require the verified external filesystem. Database snapshots do not replace backups of worktrees, artifacts, private configuration and credentials.

## Human actions before production

Approve and merge both product PRs only after their final-head reviews/checks pass. Deployment is a separate approval and plan. No persistent service or mount was installed, no boot configuration changed, and no reboot occurred.

The Pi currently has `cgroup_disable=memory`; accepting systemd limits did not enforce a memory cap, and service preflight correctly refuses unattended activation. During approved deployment, arrange and prove persistent UUID mounting while preserving existing data/services, enable the kernel memory controller with an approved reboot, verify actual limits, then follow [service operations](../../docs/service-operations.md) and [recovery procedures](../../docs/recovery.md). This release does not certify production boot, upgrade/rollback or memory-limit enforcement.
