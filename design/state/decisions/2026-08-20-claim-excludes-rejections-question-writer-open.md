# decision/2026-08-20-claim-excludes-rejections-question-writer-open
Date: 2026-08-20
Anchor: 2026-08-20 — A decision's `Claim` excludes the rejected alternatives; the question/to-do separation is stated and its writer is not
Status: accepted

## Claim
Two terms `design/10-design.md` determines are stated in `design/20-contract.md`. A decision record's `Claim` never carries the rejected alternatives — they stay in the log, and extracting the largest and least-consulted half of the corpus is what would put it back inside the per-unit budget I23's ceiling is measured against; the existing length bullet's form note does not reach it, because a terse list of rejections is not a summary. Nothing checks it. And an `## Open` item and a question record are different things: `## Open` is a to-do bound for the tracker, a question is something undecided that blocks reasoning about a unit, and becoming an issue does not discharge a question. The distinction is settled and becomes a cross-cutting obligation on commands; **which command writes a question record, and when, is not determined by the design** and is the second § *Unresolved* item, since § *Record* gives a five-step flow for a decision and has no question equivalent.
