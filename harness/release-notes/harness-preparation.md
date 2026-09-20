# Harness preparation

Delivery: repository documentation and reviewer configuration, pending human merge.
This prepares execution of the **Minimum Viable Application**; it does not implement
or release that application. Builds 001–008 remain pending.

## Delivered in this PR

- Eight ordered build contracts, each introduced in a separate planning commit.
- A repository test-first workflow: branch, meaningful failing behavior tests,
  implementation, passing verification, evidence log, and one primary build commit.
- `harness/execution-log.md` as the evidence source for release notes; `harness/build/`
  as ignored scratch output, distinct from versioned `harness/builds/` contracts.
- Separate code-review and E2E-review role files, explicit finding triage and
  verification contracts, and exact-head sign-off requirements.
- Post-review release notes, final-head revalidation by both reviewers, and owner
  notification before human merge/deployment decisions.

## Verification and review

Source of truth: [execution log](../execution-log.md).
PR: https://github.com/talaniz/prime-mover/pull/1
Reviewed preparation SHA: `e6789adad253e0d36fe67864ff47b7f7befda5b7`.

TOML parsing, local documentation links, eight sequential build/commit mappings,
contract sections, ignored scratch output, and Git whitespace checks passed.
The independent documentation-workflow walkthrough covered success, invalid test
failure, findings/fixes, stale heads, note finalization and notification boundaries.

- [Independent code sign-off](https://github.com/talaniz/prime-mover/pull/1#issuecomment-5745945327)
- [Independent documentation-workflow E2E sign-off](https://github.com/talaniz/prime-mover/pull/1#issuecomment-5745954181)

These notes were added after both sign-offs and main-task confirmation. The final
notes commit requires both reviewers' explicit revalidation; see the PR's latest
exact-head review comments for final readiness. Do not infer final readiness merely
from the presence of this file.

## Limitations and next action

No application runner, worker, polling, database, review engine or notification engine
is implemented. No runtime E2E or automated CI result is claimed. The role files were
parsed and used as instructions in fresh independent tasks; automatic named-role
discovery was not verified. Review comments are attributed sign-offs, not formal
GitHub approvals. Nothing was merged, deployed, tagged or published as a GitHub Release.

After final-head review, the owner decides whether to merge this preparation PR.
When application execution is requested, start the milestone branch and execute
builds 001–008 using the harness, accumulating all product commits in one milestone PR.
