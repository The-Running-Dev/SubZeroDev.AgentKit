# decision/2026-09-18-merge-when-green-is-delegated-to-a-script
Date: 2026-09-18
Anchor: 2026-09-18 — Merge-when-green is delegated to a script, not to a judgement
Status: accepted
StatedIn: "unit/document/agents-md § Git and delivery", "unit/command/pr § Phase 4 — merge"

## Claim
Merging a pull request is carved out of the authorization rule, on the condition that
`tools/Merge-PullRequest.ps1` confirms every gate and performs the merge itself. A session that
opens a pull request now watches it to merge rather than reporting it and stopping. The
delegation is to the script rather than to a session's reading of a checks page: the script
computes the decision from observable state, fails closed on every unknown — including a
repository with no CI configured — and never passes `--admin`, so branch protection stays an
outer gate the delegation cannot reach past. `/pr` gains a fourth phase that calls it with the
SHA phase 2's gates ran against. Four cases stay the user's: a repository the user does not own
(I9), a pull request the user asked to review, one whose description says to hold it, and any
merge to a protected branch by a route other than this script.
