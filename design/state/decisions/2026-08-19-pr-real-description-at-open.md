# decision/2026-08-19-pr-real-description-at-open
Date: 2026-08-19
Anchor: 2026-08-19 — A pull request carries its real description from the moment it is opened
Status: accepted
StatedIn: unit/command/slice § Implementing it, unit/command/pr § Phase 1 — the pull request and its description, "unit/command/fix § Fix, then hand off"

## Claim
`/slice` and `/fix` write the real pull request description as they open it, in the same shape `.claude/commands/pr.md` § *Phase 1* already fixes, rather than a placeholder deferring to `/pr`. `Verified` remains the one section allowed to say the gates have not run, since at that moment they genuinely have not.
