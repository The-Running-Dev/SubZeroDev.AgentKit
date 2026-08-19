# decision/2026-08-08-pr-absorbs-gates-drafts-abolished
Date: 2026-08-08
Anchor: 2026-08-08 — `/pr` absorbs the gate and thread phases; pull requests are never drafts
Status: accepted

## Claim
`/pr` is the whole merge-ready pipeline in three ordered phases — description, gates, review threads — running `/verify` and `/resolve` in full rather than copying their procedures. Phase 3 runs automatically, giving automated reviewers one bounded wait via `Wait-PullRequestCheck.ps1` before re-querying threads. Drafts are abolished: `/slice`, `/fix`, and `/pr` open a live pull request, and the authorization carve-out widens from opening a draft to opening a pull request outright; merging stays the user's.
