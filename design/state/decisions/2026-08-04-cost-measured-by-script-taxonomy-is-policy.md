# decision/2026-08-04-cost-measured-by-script-taxonomy-is-policy
Date: 2026-08-04
Anchor: 2026-08-04 — Cost is measured by a script, and the avoidable-work taxonomy is policy
Status: accepted
StatedIn: unit/document/agents-md § What should stop being model work

## Claim
Measurement is code — `tools/Measure-Session.ps1` reads Claude Code's own per-call usage records and reports the four input classes separately, carrying no prices of its own. The avoidable-work taxonomy is policy in `AGENTS.md` under the tier table: a command is not classified by its cheapest step, and nothing may report a cost it did not measure.
