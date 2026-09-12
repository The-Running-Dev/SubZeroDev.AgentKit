# decision/2026-09-12-unhandlederror-is-a-fourth-stop
Date: 2026-09-12
Anchor: 2026-09-12 — `UnhandledError` is a contracted fourth stop, not an unlisted implementation path
Status: accepted
StatedIn: "unit/document/design-20-contract § `tools/Invoke-DoneHousekeeping.ps1`"

## Claim
Anything thrown after the stash ends the run as a stop with `Reason` `UnhandledError` and `Detail`
carrying the message, in the shape the three named stops use, and that shape is contracted rather
than incidental: `StashRef` rides on it, so `-AutoStash` work is never lost to a path nobody
enumerated. The three named stops stay named because a caller branches on them; this one is the
residue and is not enumerable by construction.
