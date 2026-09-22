# Review-report clarification — 2026-09-21

Completed review reports with invalid evidence now enter the existing bounded clarification flow instead of failing with a generic coordinator error. The same independent reviewer must repair its report; the coordinator retains raw evidence and never silently removes checks, findings or limitations. Validation, target/authorization checks, independence and original deadlines remain enforced. Persistent invalidity stops after the original report plus two clarification turns with `invalid-review-report`.

Reviewed/deployed runtime: `011f0c88edb11c48cc32e6907f091e9218bd48ef`, [Prime Mover PR6](https://github.com/talaniz/prime-mover/pull/6). Two meaningful regressions failed before implementation; 28 affected checks and full `npm run check` passed (77 unit,208 integration,9 CLI E2E). [Code review](https://github.com/talaniz/prime-mover/pull/6#issuecomment-5770293371) and [isolated E2E review](https://github.com/talaniz/prime-mover/pull/6#issuecomment-5770318115) signed off before targeted deployment. E2E used production workflow classes with fixture external adapters and explicitly did not claim a live pass.

## Live recovery evidence

The supported operator command resumed existing DOOM issue18 job `2123eecf-7030-404e-9e60-b9e1ee5470d9` after completed-turn proof, fresh authorization and unchanged PR target verification. The original job deadline and exhausted automatic-recovery counter (3) remain unchanged. No new issue generation or replacement PR was created.

The original reviewer completed a clarification, and Prime Mover [published the valid changes-requested report](https://github.com/talaniz/doom-control/pull/19#issuecomment-5770327371). Both substantive findings, both limitations and the verdict match the original report; checks contain no empty strings. The coordinator proceeded to triage, proving resumption beyond the failing boundary.

A transient systemd continuation has the worker's resource limits and restarts the normal worker on exit; the normal supervisor remains stopped while that continuation runs. Backup/isolated restore, preflight, saved rollback unit and deployment details are recorded in the execution log. No ledger reset, unrelated service restart or manual DOOM implementation occurred.

## Limits

DOOM PR19 remains a draft with corrective work and independent reviews pending at this observation. This fix/resumption does not approve or complete its UI changes. No merge or UI deployment occurred. The Prime Mover source PR remains unmerged, and its later notes-only commit needs final-head review revalidation; no runtime redeployment is needed for these notes.
