# decision/2026-08-03-pr-defers-to-repository-merge-convention
Date: 2026-08-03
Anchor: 2026-08-03 — `/pr` defers to the repository's own merge convention
Status: accepted
StatedIn: unit/command/pr § Phase 4 — merge

## Claim
`/pr` defers to the repository's own instruction file where one exists, and defaults only where that file is silent. It carries only genuinely portable operational knowledge: push before announcing, never open from the default branch, and query `reviewThreads` by GraphQL because a blocking automated review does not appear in `gh pr view`. This entry originally also had `/pr` report the checks and leave the merge to the user; that half was superseded by `decision/2026-09-18-merge-when-green-is-delegated-to-a-script`, under which a fourth phase merges by way of `tools/Merge-PullRequest.ps1` — the deference itself is unchanged, since a repository whose instruction file withholds the delegation still has phase 4 skipped.
