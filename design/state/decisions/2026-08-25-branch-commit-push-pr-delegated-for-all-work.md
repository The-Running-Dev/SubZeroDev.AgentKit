# decision/2026-08-25-branch-commit-push-pr-delegated-for-all-work
Date: 2026-08-25
Anchor: 2026-08-25 — No work lands directly on the default branch; branch, commit, push, and PR are delegated for every session
Status: accepted
StatedIn: unit/document/agents-md § Git and delivery

## Claim
`AGENTS.md` § *Git and delivery* now requires branching off the default branch before the first edit of any work, unconditionally — not scoped to `/slice`, `/fix`, `/pr` and `/install` as it was before. Once work is on its branch, committing, pushing, and opening the pull request are delegated for any session, generalizing what those four commands already did on their own branches. `/install-all` keeps its explicit carve-out from opening PRs. Merging stays the user's alone; that carve-out is unchanged.
