# Prime Mover execution harness

One milestone: **Minimum Viable Application (MVA)**. One application implementation
branch and PR hold all build commits and subsequent review fixes/release notes.
Application execution is in progress: Builds 001–007 are complete; Build 008 remains pending.
The execution log contains actual evidence and remaining gates.

## Layout

- `builds/`: ordered build contracts; one primary implementation commit per file.
- `build/`: ignored local output/evidence scratch directory; its README is tracked.
- `execution-log.md`: authoritative, evidence-backed history used for release notes.
- `release-notes/`: notes added only after code and E2E sign-off, then revalidated.
- `../.codex/agents/`: separate code-review and E2E-review role definitions.

Both `build/` and `builds/` exist deliberately: build contracts live only in `builds/`.

## Plan and build order

Source: [Prime Mover - Execution Plan](https://docs.google.com/document/d/1-IRhU2b2su-e-4dqlygETfYMhQFnCfQ8xeRpqgCPhhE).
The following local contracts carry the eight phases into version control. Scope and
architecture details remain in the plan; build acceptance and actual results live here.

| Build | Contract | Dependency |
| --- | --- | --- |
| 001 | [Contracts and integrations](builds/001-contracts-and-integrations.md) | Harness baseline |
| 002 | [Durable scheduler](builds/002-durable-scheduler.md) | 001 |
| 003 | [Authorized intake](builds/003-authorized-intake.md) | 002 |
| 004 | [Isolated execution](builds/004-isolated-execution.md) | 003 |
| 005 | [Code review](builds/005-code-review.md) | 004 |
| 006 | [E2E and readiness](builds/006-e2e-and-readiness.md) | 005 |
| 007 | [Recovery and operations](builds/007-recovery-and-operations.md) | 006 |
| 008 | [MVA acceptance](builds/008-mva-acceptance.md) | 007 |

## Execution and delivery

Create the milestone branch → write behavior tests → prove meaningful failure →
implement → prove passing tests and required verification → log evidence → make one
primary commit for that build → repeat on the same branch/PR. Build files are plans;
committing a build file in the setup PR does not execute the build.

After implementation: independent code review/fixes/sign-off → distinct independent
E2E review/fixes/sign-off → main task verifies gates → generate and commit release
notes from the log → both reviewers revalidate final HEAD → notify the owner.
See [AGENTS.md](../AGENTS.md) for the binding procedure and final-head rules.

For this documentation-only preparation, each build contract is introduced in its
own commit. Harness-wide instructions accompany 001. Application execution later
has its own one-primary-implementation-commit-per-build sequence on the milestone PR.
Review fixes and release notes are explicit additional commits, never hidden amendments.

## Reviewer activation

Project roles are standalone TOML files with name, description, and developer_instructions,
following the [official Codex subagent format](https://learn.chatgpt.com/docs/agent-configuration/subagents).
Start fresh reviewer tasks in this trusted repository. The active collaboration tool
may not expose named-role selection; then load the role instructions into a fresh
independent task. Do not assume existing sessions reload files or that writing these
files installs/runs Prime Mover review automation.

## MVA default projects and dashboard metadata

The MVA tracks **Prime Mover** (`talaniz/prime-mover`) and **DOOM Dashboard**
(`talaniz/doom-control`) by default, both based on `main`. See
[the project metadata contract](project-metadata.md) for registry defaults, the
read-only Projects page in the existing DOOM Dashboard, build ownership and
cross-repository delivery. The default registry/metadata backend is implemented through Build 002. The DOOM page
and complete MVA acceptance remain pending; no unattended service is activated.
