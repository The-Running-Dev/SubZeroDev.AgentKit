# decision/2026-08-08-done-housekeeping-scripts-everything-before-ask
Date: 2026-08-08
Anchor: 2026-08-08 — `tools/Invoke-DoneHousekeeping.ps1` scripts everything in `/done` before its ask
Status: accepted

## Claim
`tools/Invoke-DoneHousekeeping.ps1` covers everything through building the branch-deletion candidate list and stops there by default, reproducing `done.md`'s dirty-tree and unmerged-current-branch stops exactly, including the merged-PR cross-check. Deletion is a second, explicit call — `-DeleteBranches <names>` runs `git branch -d`, never `-D`, and refuses any name `--merged` does not confirm even if asked for.
