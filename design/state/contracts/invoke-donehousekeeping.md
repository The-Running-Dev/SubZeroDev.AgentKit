# contract/invoke-donehousekeeping
Status: active
Owner: unit/script/invoke-donehousekeeping
Declaration: tools/Invoke-DoneHousekeeping.ps1

## Semantics
The mechanical half of `/clean`, whose consumer is an authorization rule rather than a module:
`AGENTS.md` § *Git and delivery* delegates a force-delete on two of its field names.
`SquashMergeCandidates` lists a branch only when a merged pull request exists for it **and** the
local branch tip equals that pull request's `headRefOid`, so the branch named is exactly the
commit that merged — the tip comparison, not the pull request's existence, is what makes the
delegation safe, because `gh pr list --head` matches on branch name and goes on reporting the
pull request after commits are pushed on top of the merged tip. A branch whose tip is not the
head that merged, or whose tip or `headRefOid` cannot be resolved, is reported in
`TipAheadOfMergedPr` with a `Reason` and is never a force-delete candidate. Deletion is never
inferred: with no delete parameter it switches, pulls, prunes, and reports candidates only.
`-DeleteBranches` runs `git branch -d`, never `-D`, and refuses any name this run's `--merged`
did not confirm; `-ForceDeleteBranches` honours only a name this same run listed in
`SquashMergeCandidates`, never one passed in from elsewhere. A refused name is reported in
`Refused` with its reason. A dirty tree, a current branch with unmerged commits and no merged
pull request, and a failed default-branch checkout each stop the run with `Reason` named and
every candidate list empty. `-AutoStash` converts the dirty-tree stop into a continue, and the
stash is never popped — `StashRef` is reported for the caller to restore explicitly.
