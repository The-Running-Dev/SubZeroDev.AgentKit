# decision/2026-09-12-ghunavailable-covers-unreadable-output
Date: 2026-09-12
Anchor: 2026-09-12 — `GhUnavailable` covers `gh` returning output that cannot be read as the answer
Status: accepted
StatedIn: "unit/document/design-20-contract § `Wait-PullRequestCheck.ps1`"

## Claim
`GhUnavailable` is about the answer, not about the process: `gh` missing, `gh` unauthenticated,
and `gh` exiting 0 with output that will not parse are one failure, because no answer exists in
any of the three and the caller's correct response is identical — report a gate that did not run.
Reading the third as `PullRequestMissing` would assert something about the pull request that
nothing established. The vocabulary stays closed; no value is added to it.
