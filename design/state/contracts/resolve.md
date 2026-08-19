# contract/resolve
Status: active
Owner: unit/command/resolve
Declaration: prose

## Semantics
Amended, not replaced, by the state-set mechanism: classification completes before the batch is
requested; "confirm the checks are green on the new head SHA" is discharged by
`Wait-PullRequestCheck.ps1`, not by reading `gh pr checks` by eye; authorization cites the
`AGENTS.md` batch rule rather than asking per action. Everything else — the GraphQL query, the
five `ThreadClass` values, the fixed order of operations, the report shape, the `Never` list —
is unchanged and stays owned by `.claude/commands/resolve.md`.
