# Blocked code-review reassessment — 2026-09-21

Operators can now run `reassess-code-review CONFIG JOB EVIDENCE_JSON REASON` to give a blocked independent code reviewer newly recovered evidence or an approved clarification. The request is tied to the current clean PR target and a stable ID. It atomically retains the original blocked report and reserves the next existing round; interruption and duplicate requests cannot create extra rounds. The same reviewer independently decides whether the evidence resolves the blocker.

Reviewed/deployed implementation: `c31f929e82094a6aa2ff60e59c8025606dac3810`, [Prime Mover PR7](https://github.com/talaniz/prime-mover/pull/7). Full checks passed strict TypeScript and 308 tests; exact-head CI passed. [Independent code review](https://github.com/talaniz/prime-mover/pull/7#issuecomment-5770813880) reproduced meaningful baseline red and signed off. [Subsequent independent E2E review](https://github.com/talaniz/prime-mover/pull/7#issuecomment-5770860559) exercised seven actual CLI workflows using real Git/SQLite and fixture external services, plus 14 targeted tests. Both reviewed the implementation before activation.

Current authorization, exact completed-turn proof, exclusive ownership, clean PR head/base/commit coverage, original deadline and recovery/correction/review limits remain enforced. Evidence is bounded untrusted context, not authority or sign-off. The initial feature covers code reviews; material scope changes and E2E reassessment are outside this path. See [operator instructions](../../docs/recovery.md#reassess-a-blocked-code-review-after-new-evidence).

## Live observation

After backup/isolated restore and successful preflight, only the worker release was updated. The new command accepted the approved clarification and original red evidence for DOOM issue18/PR19, moving beyond the cached blocked report into round3 on the same independent reviewer task. All44 prior completed operation records, the original deadline, recovery count3 and correction count1 were preserved. The normal supervisor remains stopped while the resource-limited explicit continuation owns the job.

The latest observed state at note creation is an active independent reassessment, not a new verdict or DOOM readiness. No DOOM source changes, replacement job/PR, merge, UI deployment or unrelated service restart occurred. Subsequent status is recorded on PR7. The Prime Mover source PR remains unmerged; these notes need final-head revalidation by both reviewers. Notes alone do not require a runtime redeployment.
