# decision/2026-09-18-next-names-track-only-when-owed
Date: 2026-09-18
Anchor: 2026-09-18 — `/next` names `/track` only when the tracker is owed something
Status: accepted
StatedIn: "unit/command/next § Decide, in this order", unit/command/next § Never

## Claim
`/next` fires the `/track` boundary only on an outstanding obligation — drift findings, an
unissued `## Open` item, or an open issue with every `Done when` box ticked — never on the bare
fact that a merge landed. A merge stays merged, and `/track` leaves no trace when the tracker has
not moved, so a row keyed on the merge never terminates. `MirrorStale` is not such a signal: it is
stale by construction and never reaches zero. Where nothing is outstanding the table falls through
to the rows beneath it, and "nothing is owed" is the answer.
