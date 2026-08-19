# contract/resolve
Status: active
Owner: unit/command/resolve
Declaration: prose

## Semantics
Amended, not replaced, by the state-set mechanism: classification completes over the full thread
table before any thread is acted on; "confirm the checks are green on the new head SHA" is
discharged by `Wait-PullRequestCheck.ps1`, not by reading `gh pr checks` by eye; and
authorization cites `AGENTS.md`, *Git and delivery* — a `Defect`-class thread the pushed fix
satisfies is resolved without asking first, `Ambiguous` threads are still brought individually,
and in a repository the account does not own every action reverts to an individual ask (I9).
Everything else — the GraphQL query, the five `ThreadClass` values, the fixed order of
operations, the report shape, the `Never` list — is unchanged and stays owned by
`.claude/commands/resolve.md`.
