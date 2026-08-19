# decision/2026-08-04-slice-takes-no-argument-reads-doneness-from-tracker
Date: 2026-08-04
Anchor: 2026-08-04 — `/slice` takes no argument, and reads doneness from the tracker only
Status: accepted

## Claim
`/slice`'s slice id is optional. Given, it wins outright and is never substituted, even for a slice whose dependencies are unmet. Absent, the next slice is the lowest-numbered one that is not done and whose dependencies are done, announced in one line before anything else happens; a partially ticked slice counts as in progress, not done, and its unticked criteria are re-established rather than trusted.
