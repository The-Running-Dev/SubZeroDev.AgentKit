# unit/script/new-reducedprompt
Kind: script
Status: active
Anchor: tools/New-ReducedPrompt.ps1
Consumes:
Exposes:
Binds:
Live:
Questions:
Work: work/12
Evidence: tools/New-ReducedPrompt.Tests.ps1

## Owns
Assembles a reduced-context prompt for one slice — the slice's own block from
`design/30-slices.md`, `design/20-contract.md` verbatim, and only the `AGENTS.md` sections
`.claude/commands/slice.md` cites as binding a slice, with `agent.md` dropped — for a target
model with a smaller context budget than the full `/slice` prompt assumes.
