# Release notes

Create a delivery-specific Markdown file only after independent code and E2E review
sign off and the main task confirms the review gates. Derive every delivered claim
from `../execution-log.md`, checked against commits and PR evidence.

Include scope/status, delivered behavior, verification, reviewed implementation SHA,
review report/PR links, limitations, and human merge/deployment steps. A preparation
PR describes only its preparation work. Do not publish a GitHub Release or tag simply
because this directory contains notes.

Commit notes and their log entry, then get both reviewers to revalidate final HEAD.
Keep those final sign-offs on the PR to avoid recursive documentation commits.
