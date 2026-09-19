# contract/repoaliases
Status: active
Owner: unit/script/repoaliases
Declaration: tools/RepoAliases.ps1

## Semantics
Exposes `Invoke-AgentKitClean` and `Get-AgentKitNext` only when dot-sourced from an interactive
PowerShell profile, never as a scheduled task: sequential-by-policy concurrency means an
unattended run could stash or switch a branch beneath a session that is mid-edit. Each function
delegates its mechanical script and returns that script's result; `Get-AgentKitNext` also writes
the orientation result's plain-language `Summary` values before returning the full object. Never
opens a model session or decides a judgement case: its output leaves that call to the person at the
terminal.
