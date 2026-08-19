# decision/2026-08-20-fix-picks-its-own-bug-when-given-nothing
Date: 2026-08-20
Anchor: 2026-08-20 — `/fix` picks its own bug when given nothing, and the contract carries the fourth form
Status: accepted

## Claim
`/fix` has four invocation forms, not three: an issue number, a description, a failing test already in context, or nothing at all — in which case it ranks the open issues by an explicit priority signal where one exists and by age where none does, and picks the highest-value open bug itself. That fourth form is the only one that reaches the tracker before it has a defect, so an unreachable `gh` stops it where the others are unaffected until they file or push, and it never falls through from an issue it picked and could not reproduce.
