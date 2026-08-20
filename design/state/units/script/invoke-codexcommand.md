# unit/script/invoke-codexcommand
Kind: script
Status: active
Anchor: tools/Invoke-CodexCommand.ps1
Consumes:
Exposes:
Binds:
Live:
Archival:
Questions:
Work:
Evidence:

## Owns
Maps a command name to the Codex profile (`architect`/`builder`/`quick`) that `AGENTS.md`'s
*Command routing* table requires, and execs `codex --profile <profile>` so profile selection
is not left to memory.
