# decision/2026-09-26-companion-authorization-narrowing-is-a-grammar
Date: 2026-09-26
Anchor: 2026-09-26 — A companion's `tightened-authorization` override is a grammar checked against its core's authorization set
Status: accepted
StatedIn: contract/test-companion § Semantics, unit/document/design-20-contract § Documents that carry surface

## Claim
`tightened-authorization` is checked mechanically by making a widening unrepresentable rather than
by detecting one. A core that allows the category lists, in its companion block, the actions it
performs without asking, each an id from an action table in `.claude/COMPANIONS.md` whose rows
name the `AGENTS.shared.md` carve-out granting each action and never restate it. A companion's
override under that heading is only `ask-before` entries, one action id per line, no trailing
text; the entries must be a subset of the core's list. `tools/Test-Companion.ps1` gains four
findings — `NoDelegatedActions`, `UnknownAction`, `NonConformingAuthorization`,
`UndelegatedAction` — reads the category and action tables each scoped to its own section, and
returns `NotEvaluated` when the action table is missing or empty. Existing prose overrides are
migrated by hand in the repository that owns them. I33 states the guarantee and arrives
`Enforcement: instruction` until the slice that lands the check evidences it.
