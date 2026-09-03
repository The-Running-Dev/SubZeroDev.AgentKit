# decision/2026-08-30-force-delete-delegated-on-tip-comparison
Date: 2026-08-30
Anchor: 2026-08-30 — Force-deleting a squash-merged branch is delegated, on a tip-equals-merged-head comparison rather than a confirmation prompt
Status: accepted
StatedIn: unit/document/agents-md § Git and delivery, unit/command/clean § Force-delete a squash-merged candidate — don't ask either

## Claim
`tools/Invoke-DoneHousekeeping.ps1` lists a branch in `SquashMergeCandidates` only when a merged pull request exists for it **and** the local branch tip equals that pull request's `headRefOid`. On that evidence `/clean` force-deletes every entry without a chat confirmation, on the same terms as the `--merged` carve-out. A branch whose tip is not the head that merged is reported in `TipAheadOfMergedPr` and is never force-deleted; that is the case `gh pr list --head` still reports as merged and `-D` would silently discard, and it is the case the confirmation prompt was nominally guarding and never actually checked.
