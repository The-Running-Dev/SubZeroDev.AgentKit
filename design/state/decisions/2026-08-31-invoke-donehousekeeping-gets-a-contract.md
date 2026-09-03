# decision/2026-08-31-invoke-donehousekeeping-gets-a-contract
Date: 2026-08-31
Anchor: 2026-08-31 — `tools/Invoke-DoneHousekeeping.ps1` acquires a contract entry, because an authorization rule rests on two of its field names
Status: accepted
StatedIn: unit/document/design-20-contract § `tools/Invoke-DoneHousekeeping.ps1`, contract/invoke-donehousekeeping § Semantics

## Claim
`tools/Invoke-DoneHousekeeping.ps1` joins `design/20-contract.md` § *Public surface* with a `contract/invoke-donehousekeeping` record, whose `Semantics` states what `SquashMergeCandidates` and `TipAheadOfMergedPr` guarantee and why the tip comparison is what makes `AGENTS.md`'s force-delete delegation safe. Those two field names carry a delegation of a destructive action and had no record resolving them, which is the unchecked restatement I15 forbids. The amendment is `/contract`'s.
