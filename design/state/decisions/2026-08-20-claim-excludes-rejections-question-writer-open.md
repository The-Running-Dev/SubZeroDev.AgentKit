# decision/2026-08-20-claim-excludes-rejections-question-writer-open
Date: 2026-08-20
Anchor: 2026-08-20 — A decision's `Claim` excludes the rejected alternatives; the question/to-do separation is stated and its writer is not
Status: accepted

## Claim
A decision record's `Claim` never carries the rejected alternatives — they stay in the log, and nothing checks it. An `## Open` item and a question record are different things: `## Open` is a to-do bound for the tracker, a question is something undecided that blocks reasoning about a unit, and becoming an issue does not discharge a question. That distinction is a cross-cutting obligation on commands. **Which command writes a question record, and when, is not determined by the design** and is the second § *Unresolved* item.
