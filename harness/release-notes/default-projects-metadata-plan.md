# MVA planning amendment: default projects and metadata

Delivery: planning documentation only. Application builds 001–008 remain pending;
no project tracking, worker or dashboard feature has been implemented or activated.

PR: https://github.com/talaniz/prime-mover/pull/2
Reviewed planning SHA: `61ccf4686841300c45e85727c53c2322728774c3`.

## Delivered plan changes

- Two default projects: Prime Mover (`talaniz/prime-mover`) and DOOM Dashboard
  (`talaniz/doom-control`), both using main with one global active job/turn.
- Read-only Projects list/details in the existing DOOM Dashboard within the MVA,
  covering tracking/job metadata, freshness, blockers and unavailable/empty states.
- Per-project authorization and isolation, authenticated/redacted metadata without
  execution side effects, and a linked DOOM integration PR with combined evidence.
- Updated build ownership and the Drive execution plan, including MVA-8 visibility.

## Verification and review evidence

The execution log records verified repository origin/default-branch probes,
Markdown-link validation, role TOML parsing, eight build contracts and clean whitespace.
Drive native readback retained one tab, 13 heading sections and ordered MVA-1–8 criteria.

- [Independent code sign-off](https://github.com/talaniz/prime-mover/pull/2#issuecomment-5752329631)
- [Independent documentation-workflow E2E sign-off](https://github.com/talaniz/prime-mover/pull/2#issuecomment-5752340364)

Both reports cover the reviewed planning SHA above. The E2E reviewer walked all seven
metadata scenarios and independently checked local identities and original checkout
state. This is documentation review, not application/browser E2E evidence. No automated
CI status checks were reported. Final-head revalidation for this notes commit is
recorded on the PR; review comments are not formal GitHub approvals.

## Remaining work

Human approval is required before merging this planning PR. The original checkout
remains on clean main; the proposed repository changes are on the PR branch. The
Drive plan is already updated in place. MVA implementation, the dashboard integration
PR, runtime tests, live rehearsal and separately authorized deployment remain future
work. Nothing in this change activates issue intake or changes the live DOOM service.
