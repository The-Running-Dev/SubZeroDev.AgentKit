# decision/2026-08-04-slice-creates-own-branch-and-pushes
Date: 2026-08-04
Anchor: 2026-08-04 — `/slice` creates its own branch, commits, and opens its PR as a draft
Status: accepted
StatedIn: unit/command/slice § Implementing it

## Claim
`/slice` checks out `slice/S<n>` from the default branch before implementing, refusing to proceed on the default branch itself, and after the full suite passes commits by named path and pushes. This entry originally also had `/slice` open its pull request as a draft; that specific mechanism was superseded by `decision/2026-08-08-pr-absorbs-gates-drafts-abolished`, under which `/slice` opens a live pull request instead.
