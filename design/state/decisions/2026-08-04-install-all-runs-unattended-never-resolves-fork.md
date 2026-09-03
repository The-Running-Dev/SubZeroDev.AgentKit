# decision/2026-08-04-install-all-runs-unattended-never-resolves-fork
Date: 2026-08-04
Anchor: 2026-08-04 — `/install-all` runs the install unattended, but never resolves a fork on its own
Status: accepted
StatedIn: unit/command/install-all § Phase 2 — Apply without a human in the loop

## Claim
`.claude/commands/install-all.md` orchestrates discovery, ordering, and one `INSTALL.md` run per target through phase 2. Resolutions `INSTALL.md` already states as deterministic apply without pausing; every stop-and-report fork is skipped for that repository only, recorded as needing a decision, and the run continues to the next target. It never commits, pushes, or stages, the same as `INSTALL.md`.
