# decision/2026-08-30-next-command-orients-and-acts
Date: 2026-08-30
Anchor: 2026-08-30 — `/next` orients like `/kit-help` and then acts, stopping at every session boundary rather than crossing it
Status: accepted

## Claim
`/next` decides what the repository owes from what it reads — the tree, the tracker, `Test-DesignDrift.ps1` and `Test-DesignState.ps1` — and runs the next step where that step is legal in the current session. Where `AGENTS.md` § *Session boundaries* requires a fresh session, or where the next step is deep-reasoning tier, it emits the banner and stops rather than crossing. One routed command per invocation. `/kit-help` keeps sole ownership of the stage map and `/next` reads it; `/next` adds only the act-or-stop rule and the outstanding-work check. Nothing is ever assumed owed, which is the property that makes it safe as `/clean`'s handoff target where an unconditional `/track` was not.
