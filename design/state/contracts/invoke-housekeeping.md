# contract/invoke-housekeeping
Status: active
Owner: unit/script/invoke-housekeeping
Declaration: tools/Invoke-Housekeeping.ps1

## Semantics
Runs `/clean`'s mechanical branch cleanup without a model. It discovers once through
`Invoke-DoneHousekeeping.ps1 -AutoStash`, then, unless discovery stopped, makes one
`-SkipPull` apply call using only that result's `Candidates` as `-DeleteBranches` and
`SquashMergeCandidates` as `-ForceDeleteBranches`. A stopped discovery performs no apply call,
returns `Escalate:true`, preserves `Discover`, and leaves `Applied` null. Otherwise confirmed
deletions may proceed while any `TipAheadOfMergedPr` or `Refused` entry sets `Escalate:true`
and remains a named judgement case. Reports the stash reference and cleanup outcome in plain
language, preserves both passes in the returned object, and never decides a judgement case or
opens a model session.
