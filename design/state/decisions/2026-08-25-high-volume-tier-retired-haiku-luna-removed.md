# decision/2026-08-25-high-volume-tier-retired-haiku-luna-removed
Date: 2026-08-25
Anchor: 2026-08-25 — The High volume tier is retired; `/kit-help` and `/done` route to Implementation, and no row maps to `haiku`
Status: accepted
StatedIn: unit/document/agents-md § Command routing, unit/document/agents-md § Vendor model aliases

## Claim
The High volume tier is retired from `AGENTS.md` § *Model, effort, and review budget*'s primary model table. `/kit-help` and `/done`, its only two commands, now route `sonnet`/`medium` in § *Command routing*, matching what a Codex `Terra` session already resolves to under § *Vendor model aliases* and ending the overpowered-session gate stop those commands were hitting on every run. The `haiku` name is removed from every place it named a live routing target. The `Luna` alias is dropped rather than remapped to Implementation, and dropped from the "has been observed reporting" list in § *Vendor model aliases* — a `Luna` self-report is now a genuine mismatch that stops the gate rather than silently resolving.
