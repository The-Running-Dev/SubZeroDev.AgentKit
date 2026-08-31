# decision/2026-08-31-agents-md-owns-record-writing-sequence
Date: 2026-08-31
Anchor: 2026-08-31 — `AGENTS.md` is the canonical record-writing sequence; the design and the contract point at it
Status: accepted
StatedIn: unit/document/design-10-design § Record — a decision is made, unit/document/design-20-contract § Cross-cutting obligations on commands

## Claim
`AGENTS.md` § *Writing a design-state record* is the one copy of the sequence. `design/10-design.md` § *Record* keeps only what the design uniquely owns — the trade the structured writes buy, why naming the site is a step rather than a cleanup pass, and why regeneration precedes the check — and cites `AGENTS.md` for the steps; `design/20-contract.md` § *Cross-cutting obligations on commands* cites it too, plus the two orderings a command may not reverse. `AGENTS.md` is the copy an installed target carries, which is why #44 already made it the citation target for `/reconcile`, `/contract` and `/design`.
