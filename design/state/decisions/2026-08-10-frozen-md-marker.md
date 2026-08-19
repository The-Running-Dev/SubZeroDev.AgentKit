# decision/2026-08-10-frozen-md-marker
Date: 2026-08-10
Anchor: 2026-08-10 — `design/FROZEN.md` freezes the design docs, and five commands refuse while it exists
Status: accepted

## Claim
`design/FROZEN.md`'s existence is the entire freeze mechanism. While it exists, `/reconcile`,
`/track`, `/design`, `/contract` and `/slices` refuse and reproduce the marker's `Frozen
because` and `Lifts when` lines verbatim. Lifting is manual: delete the file, then
`/reconcile`, then `/track`.
