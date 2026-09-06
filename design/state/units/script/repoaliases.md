# unit/script/repoaliases
Kind: script
Status: active
Anchor: tools/RepoAliases.ps1
Consumes:
Exposes:
Binds:
Live: decision/2026-09-06-clean-and-next-mechanical-halves-run-from-a-shell-alias
Questions:
Work:
Evidence:

## Owns
The shell-alias entry point for issue #183's no-model path: dot-sourced from a PowerShell
profile, it exposes `Invoke-AgentKitClean` and `Get-AgentKitNext`, wrapping
`tools/Invoke-Housekeeping.ps1` and `tools/Get-NextOrientation.ps1` for interactive use.
