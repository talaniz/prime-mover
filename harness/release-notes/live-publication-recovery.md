# Live publication recovery — 2026-09-21

When main advances during implementation, publication now reports `base-branch-changed` instead of generic `implementation-error`. The exact-base guard remains enforced before push/PR creation. Recovery documentation explains retaining the terminal generation and using authorized cancellation/rerun against the new base, without erasing history, resetting prior budgets, or reusing stale verification.

Reviewed runtime: `d338686980251e505b664391de8b1fc56541b7fa` in [Prime Mover PR #5](https://github.com/talaniz/prime-mover/pull/5). Regression red demonstrated the misleading code; green passed 16 affected tests and full checks (77 unit, 206 integration, 9 CLI E2E). [Code review](https://github.com/talaniz/prime-mover/pull/5#issuecomment-5769879521) and [isolated workflow E2E](https://github.com/talaniz/prime-mover/pull/5#issuecomment-5769904610) signed off before the explicitly authorized targeted worker deployment. Only worker release paths changed; backup/restore, preflight and rollback preparation are recorded in the execution log.

## Real workflow result

Prime Mover processed [DOOM issue #16](https://github.com/talaniz/doom-control/issues/16) through freshly authorized generation 1, acknowledgment, actual implementation, commit, verification, push, and [published draft PR #17](https://github.com/talaniz/doom-control/pull/17). Its head is `3bb086cb690f7a5f510af0e62aa601d35e9b462c` on base `643911acadc72e129a22617b5cc755e7505fe8c9`, with 23 changed files (200 additions/11 deletions). The diff addresses relative project timestamps, keyboard/touch exact-time access, deterministic tests, and visual evidence. No operator-written implementation or manually published issue PR was substituted.

Both configured worker commands passed, including 30 tests; [GitHub CI passed](https://github.com/talaniz/doom-control/actions/runs/35676269598). [The implementation evidence index](https://github.com/talaniz/doom-control/blob/3bb086cb690f7a5f510af0e62aa601d35e9b462c/docs/ui-evidence/project-timestamps/index.md) records browser checks and 18 screenshots; all four source fingerprints match that head. Original generation 0's operations, budgets, commit and worktree remain preserved.

## Status and limits

The publication milestone is proven. The DOOM PR is draft and independent code/E2E reviews were pending at this observation; passing implementation checks and CI do not establish approval or completion of the issue. No DOOM merge or UI deployment occurred. Normal automated reviews may continue under their existing gates.

The Prime Mover fix is deployed from its reviewed runtime commit under the user's explicit authorization; its source PR remains unmerged. This later documentation-only commit needs both final-head review revalidations, recorded on PR #5. There is no need to redeploy unchanged runtime code for these notes.
