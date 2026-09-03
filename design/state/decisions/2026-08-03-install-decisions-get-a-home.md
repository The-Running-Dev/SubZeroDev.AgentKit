# decision/2026-08-03-install-decisions-get-a-home
Date: 2026-08-03
Anchor: 2026-08-03 — Install decisions get a home even when `design/` is skipped
Status: accepted
StatedIn: unit/document/install-md § Phase 4 — Apply

## Claim
Install-time decisions are logged in a resolution order — `design/90-decisions.md` when it exists, else the target's own slice-local log, else a `Why it is installed this way` subsection in whichever instruction file holds content — with rejected alternatives compressed to a clause each. Skipping `design/` does not skip the record, because that is precisely the case where the reasoning is least recoverable later.
