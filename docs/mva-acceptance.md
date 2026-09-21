# MVA acceptance and review evidence

Product PRs: [Prime Mover #3](https://github.com/talaniz/prime-mover/pull/3) and
[DOOM #14](https://github.com/talaniz/doom-control/pull/14). These are one MVA with
one linked dashboard integration. Implementation CI and independent product reviews
passed; [release notes](../harness/release-notes/mva.md) record the reviewed heads.
Final documentation-head revalidations and readiness status are authoritative on
the PRs; no merge/deployment is implied.
The [execution log](../harness/execution-log.md) is the source of truth.

## Criteria and evidence

| Criterion from the execution plan | Verified implementation evidence | Review result / remaining boundary |
| --- | --- | --- |
| MVA-1 Authorized intake | Intake policy/HTTP/integration tests cover maintainer event, contract, withdrawal, edits, pagination and per-project failures. Live fixture #10 was authorized and acknowledged once. | Product code and E2E passed at `de3c39f`; final documentation-head revalidation on PR #3 |
| MVA-2 Durable isolation | Process contention, scheduler, workspace, recovery lease and startup recovery tests; live worker killed after task/turn acceptance and recovered without replacing them. | Product code and E2E passed at `de3c39f`; final documentation-head revalidation on PR #3 |
| MVA-3 App-server implementation | Actual app-server implementation, independent configured checks and one draft fixture PR #11; task/turn/head/base in the receipt. | Product code and E2E passed at `de3c39f`; final documentation-head revalidation on PR #3 |
| MVA-4 Independent review | Separate code and E2E tasks signed fixture head `3b655d4`; Build 005 live seeded defect/fix/re-review and Build 006 correction-round integration evidence are in the log. | Both product reviews passed; final documentation-head revalidation remains on the PRs |
| MVA-5 Honest readiness | Gate/head drift/check tests; exactly one verified fixture notification; controlled failing GitHub status revoked readiness, then recovery restored it with no new turns or budget reset. | CI and both reviews passed at `de3c39f`; final documentation-head results on PR #3 |
| MVA-6 Operability | CLI pause/cancel/retry, typed blockers, budget/resource/storage failures, tested SQLite backup and paused isolated restore, transient service ordering/stop/restart evidence and runbooks. | Approved deployment must prove persistent boot mount and enable/enforce the kernel memory controller |
| MVA-7 Human control/delivery | All PM builds remain on #3; dashboard is #14. Runtime publishes draft PRs/readiness comments and has no merge/deploy path. | Both implementation review cycles passed and release notes recorded; final-head results on PRs before marking ready |
| MVA-8 Project visibility | Two-default configuration/intake/concurrency tests plus actual metadata CLI → authenticated DOOM → Chromium list/detail/outage checks; unchanged durable execution-state digest. | DOOM reviews and paired `de3c39f`/`4aacb60` integration passed; final notes-only delta assessed on PRs |

## Independent product acceptance

Prime Mover implementation `de3c39f6bf8597ad7a468a49f44b5af7ad23e7f7` has
[code sign-off](https://github.com/talaniz/prime-mover/pull/3#issuecomment-5755058371),
[separate E2E sign-off](https://github.com/talaniz/prime-mover/pull/3#issuecomment-5755177041)
and [passing CI](https://github.com/talaniz/prime-mover/actions/runs/35558077103).
The E2E reviewer independently repeated intake→implementation→seeded findings→fix→
code re-review→separate E2E→readiness on fixture #12/PR #13, plus controlled failed
status/recovery without additional turns. Its separate #14/PR #15 rehearsal proved
accepted-turn SIGKILL recovery with unchanged task/turn intents and budget. The
latter is crash-only evidence, not a reviewed/ready fixture PR. Actual operator,
backup/paused-restore/overwrite-refusal and service-preflight checks also passed.

DOOM `4aacb601a8e158aa9310b8c62fd8a2c0464f70e7` has independent code and E2E
sign-offs linked in the release notes. Its [paired-head revalidation](https://github.com/talaniz/doom-control/pull/14#issuecomment-5755074318)
proves actual CLI/browser metadata, including pending-review visibility after
listener SIGKILL/restart. These are product reviews, separate from fixture-output
reviews. The final notes commit requires explicit reviewer revalidation on the PRs.

## Live fixture and boundaries

The historical sanitized [live receipt](../harness/evidence/mva-live.json) records the owned
private fixture repository, issue/PR, role task and turn IDs, exact head/base,
public review and notification links, and controlled failed-check recovery.
Raw local logs and runtime configuration remain in ignored `harness/build/` and
isolated external-volume runtime directories, never in git.

- [Fixture issue #10](https://github.com/talaniz/prime-mover-fixture/issues/10)
- [Draft fixture PR #11](https://github.com/talaniz/prime-mover-fixture/pull/11)
- [Code sign-off](https://github.com/talaniz/prime-mover-fixture/pull/11#issuecomment-5754799088)
- [Separate E2E sign-off](https://github.com/talaniz/prime-mover-fixture/pull/11#issuecomment-5754821860)
- [Single readiness notification](https://github.com/talaniz/prime-mover-fixture/pull/11#issuecomment-5754823145)

These reports certify the generated fixture change, not Prime Mover itself. The
independent product reviews above separately assessed the engine and real workflows.
Issue #10 was subsequently deauthorized/cancelled, as were the independent reviewer's
completed #12 and crash-only #14. Their PRs remain draft/unmerged; receipt readiness
is historical, not a claim of currently authorized work.
Earlier fixture #8/PR #9 supplies the seeded code-finding correction evidence; its
label was subsequently withdrawn and its local job is cancelled. It is historical
evidence, not currently authorized work or a current ready job.

The DOOM PR includes fixture screenshots and an actual-service integration receipt.
Fixture screenshots prove rendering states; real-service browser tests prove schema
compatibility and absence of execution mutations. Neither is substituted for the
other or for independent E2E review. Default production repositories were inspected
read-only; synthetic jobs in isolated registries exercise both identities without
changing production issues or checkouts.

## Repeatable checks

From a fresh clone of the intended PR head on Linux with Node 22.23.2 / npm 10.9.8,
Git and Bubblewrap (`/usr/bin/bwrap`) installed, and unprivileged user namespaces
available for isolated verification:

```sh
npm ci --ignore-scripts
npm run check
```

A fresh external-volume clone at Build 007 head passed strict TypeScript and all
285 tests (77 unit, 199 integration, 9 CLI E2E), with zero dependency audit findings.
After review fixes, the independent fresh clone and CI passed **291 tests**
(77 unit, 205 integration, 9 CLI E2E) at `de3c39f`. Build 008 acceptance scripts
were separately exercised against the actual Pi environment; later behavioral
changes require relevant new verification.
CI uses the same dependency/check commands, pinned actions, read-only repository
permissions, no persisted checkout credential and no injected production secrets.
The Ubuntu 22.04 CI job installs Bubblewrap and proves namespace creation before
running checks. Missing sandbox prerequisites are errors; tests are never skipped
or run without isolation as a fallback. Live scripts are not invoked in CI.

Run supervised live acceptance only against the owner-controlled disposable fixture.
`scripts/verify-mva-fixture.mjs` observes a completed fixture, independently exercises
valid/invalid behavior, rechecks readiness, and verifies role independence and one
remote notification. It refuses an existing output path to preserve prior evidence.
It never starts a replacement issue, job, task or turn. The separate
`scripts/rehearse-readiness-recovery.mjs` intentionally changes a fixture commit
status; it is an explicit acceptance tool, not a runtime worker operation.

See [service operations](service-operations.md) and [recovery](recovery.md) for
installation, mount/resource gates, backup scope, restore, retention and rollback.
The Pi's disabled memory cgroup and desktop-managed mount remain deployment
prerequisites. No persistent mount/service installation or reboot occurred.
