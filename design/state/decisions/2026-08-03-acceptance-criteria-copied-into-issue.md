# decision/2026-08-03-acceptance-criteria-copied-into-issue
Date: 2026-08-03
Anchor: 2026-08-03 — Acceptance criteria are copied into the issue, and drift is reported not fixed
Status: accepted
StatedIn: unit/command/track § Slices → issues

## Claim
A slice's acceptance criteria are copied into the issue as `Done when` checkboxes — a deliberate second copy, because the tracking surface has value a pointer cannot provide. `/track` compares them on every run and reports a difference without editing either side; a ticked checkbox is never overwritten by regeneration.
