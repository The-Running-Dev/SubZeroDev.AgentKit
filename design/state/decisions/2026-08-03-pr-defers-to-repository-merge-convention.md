# decision/2026-08-03-pr-defers-to-repository-merge-convention
Date: 2026-08-03
Anchor: 2026-08-03 — `/pr` defers to the repository's own merge convention
Status: accepted
StatedIn: unit/command/pr § Merging

## Claim
`/pr` defers to the repository's own instruction file where one exists, and defaults only where that file is silent — opening the PR, reporting checks, and leaving the merge to the user. It carries only genuinely portable operational knowledge: push before announcing, never open from the default branch, and query `reviewThreads` by GraphQL because a blocking automated review does not appear in `gh pr view`.
