# unit/script/invoke-codexcommand
Kind: script
Status: active
Anchor: tools/Invoke-CodexCommand.ps1
Consumes:
Exposes:
Binds:
Live: decision/2026-08-30-tier-gate-reads-environment-stamp-first
Questions:
Work:
Evidence:

## Owns
Maps a command name to the Codex profile (`architect`/`builder`/`quick`) that `AGENTS.md`'s
*Command routing* table requires, and execs `codex` with that profile's model, reasoning
effort, approval policy, and sandbox mode passed directly as `-m`, `-c
model_reasoning_effort=<x>`, `-a`, and `-s` flags (not `--profile`, per issue #117) so
profile selection is not left to memory.
