# MVA project defaults and metadata view

Status: registry defaults and the read-only metadata backend are implemented through Build 002.
Issue tracking/execution and recovery are implemented through Build 007. The DOOM Projects UI and actual-service browser integration are implemented in linked DOOM PR #14; independent final-head reviews remain pending. No unattended service is activated.
This extends the sole Minimum Viable Application milestone, not a later milestone.

## Default project registry

| Stable project ID | Display name | GitHub repository | Base branch | Existing Pi checkout |
| --- | --- | --- | --- | --- |
| prime-mover | Prime Mover | talaniz/prime-mover | main | /home/palpatine/prime-mover |
| doom-dashboard | DOOM Dashboard | talaniz/doom-control | main | /home/palpatine/doom-control-room |

Both identities and remote default branches were verified directly. Checkout paths
are discovery references, never execution worktrees. Prime Mover's path is a symlink
to external storage. Work on either project uses isolated external-volume worktrees;
self-development cannot modify/reload the running worker or live DOOM checkout.

Seed both projects idempotently in configuration/registry defaults. Preserve operator
settings on restart or migration; never overwrite a disabled project or create
duplicates. Each project has its own maintainer allowlist, trusted setup/verification
commands, allowed paths and limits, validated before intake. Missing credentials or
configuration marks that project blocked, never ready. Registry membership is not
issue authorization: require an allowlisted maintainer's codex-ready event and an
accepted issue contract. No automatic job creation merely because a project exists.

Use repository identity in job keys, checkpoints, authorization, worktree/branch
mapping and result attribution. Equal issue numbers in different repositories must
remain distinct. Poll both eligible projects with bounded, fair scheduling so one
busy or unavailable project cannot starve the other. Keep **one active job and one
active agent turn globally**, including self-development; two projects do not enable
parallel execution. Maintain independent per-project poll checkpoints/errors.

## Read-only Projects page in DOOM

Add a Projects entry to the existing authenticated DOOM Dashboard and a list/detail
view for both default projects. Do not build a new dashboard or project-add/edit UI.
Manual project creation and management controls are outside this change in scope.

Show stable ID/name, repository link, configured base branch, tracking state
(enabled/paused/blocked), last successful poll, snapshot observation time, queued
job count, active job/stage with issue/PR links when available, most recent outcome,
and a redacted actionable blocker. A globally paused intake state must also be
visible. No jobs yet is an explicit empty state, not an error or a success claim.

Prime Mover owns a versioned read-only metadata contract sourced from its validated
registry and durable job state. DOOM consumes it through its authenticated server;
never open worker mutation APIs to the browser or share the SQLite file directly.
Build 001 chooses and documents the local authenticated transport, freshness bound
and schema version; no public listener is assumed. Responses are restricted to
allowlisted project metadata. Exclude credentials, private transcripts, command
environments and sensitive local paths. Validate repository/issue/PR URLs and escape
untrusted display text. Unknown project identifiers are rejected without data leaks.

Display loading, empty, paused, blocked and unavailable states. Timestamp any cached
snapshot, label it stale after the configured freshness bound or a failed refresh,
and never present unavailable data as a zero queue or healthy tracking. Metadata
reads must not create jobs, acknowledge issues, start turns or mutate intake state.
An unauthenticated request must fail. Worker unavailability must leave unrelated
DOOM functions usable. Configuring defaults does not activate unattended service.

## Build ownership and delivery

- Build 001 defines and validates both registry defaults, per-project configuration,
  metadata schema/transport/auth/freshness contract and cross-repository dependency.
- Build 002 implements persistent registry/state and read-only metadata projection;
  contention tests cover jobs from both projects under the global concurrency cap.
- Build 003 polls/authorizes both repositories independently, including pagination,
  starvation prevention, duplicate issue numbers and per-project failures.
- Build 004 verifies isolation for self-development and DOOM jobs.
- Build 008 requires the integrated DOOM Projects page plus both-project acceptance,
  freshness/error/auth scenarios and evidence, in addition to existing MVA gates.

All Prime Mover product commits stay on its single milestone PR. Dashboard source
changes belong on one separately reviewed linked integration PR in talaniz/doom-control,
within the same MVA. This is a cross-repository dependency, not a phase PR in Prime
Mover. Each product PR needs its own independent code and E2E reviews on its final
SHA. Integrate and test the two unmerged heads in isolated checkouts; record both
SHAs and schema compatibility. Either changed head requires affected integration
checks and review revalidation. Do not mark the MVA ready without dashboard evidence.
Human merge/deployment approval remains required separately for both repositories.

## Acceptance and verification scenarios

1. Fresh configuration lists exactly the two defaults; restart preserves identity
   and operator settings. Missing credentials produce a per-project blocked state.
2. Authorized fixture work for either identity is attributed correctly; unauthorized
   labels and absent criteria do not execute. Same-number issues do not collide.
3. Two projects with queued work still permit only one active job/turn. Repeated polls,
   restart and a failing project preserve checkpoints and eventually serve the other.
4. In an isolated DOOM instance, sign in, open Projects and inspect both records;
   exercise no jobs, active/queued jobs, last outcome, paused intake and blockers.
5. Stop the metadata source or age its snapshot: show unavailable/stale timestamps,
   not fabricated health/counts, while unrelated DOOM task access remains usable.
6. Unauthenticated reads fail; unknown IDs and hostile text/URLs are handled safely;
   response inspection finds no secrets. Repeated reads cause no execution side effects.
7. Record real integrated browser/server evidence against both reviewed heads.
   Fixture adapters cover deterministic failure cases; supervised live GitHub/app-server
   rehearsal uses explicitly designated disposable repositories, not automatic intake
   of production issues. Verify default identities separately with read-only probes.

Planning verification uses document consistency/link checks and these operator
walkthroughs. They do not substitute for the application tests and live integration
required when builds 001–008 are implemented.
