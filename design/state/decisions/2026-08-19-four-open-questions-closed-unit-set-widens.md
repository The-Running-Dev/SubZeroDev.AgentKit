# decision/2026-08-19-four-open-questions-closed-unit-set-widens
Date: 2026-08-19
Anchor: 2026-08-19 — The four open questions in `design/10-design.md` are closed; the unit set is 59, not 49
Status: accepted

## Claim
Four open questions in `design/10-design.md` are closed: the standing corpus outside `design/` (`AGENTS.md`, `agent.md`, `.claude/COMPANIONS.md`, `INSTALL.md`, `README.md`) becomes document units, since an invariant whose owner is not a unit is a dangling edge; the closed divergence-class list lives in `design/20-contract.md`, with the checker declaring detection and `ClassListDisagreement` comparing the two; `templates/design/*.md` get records, against the recommendation, so the seed becomes addressable design state rather than payload; and the cost baseline is `/slice` on a real slice, over `/reconcile`, because a benchmark chosen to flatter the change is the reporting failure *Verification* exists to catch. `design/00-brief.md`'s enumeration line is corrected to name the unit *kinds* and point at `20-contract.md` § *Artifacts of a unit kind* rather than a number the project itself keeps invalidating.
