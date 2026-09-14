# decision/2026-09-14-unfreeze-splits-across-sessions-for-a-tool-that-cannot-switch-tier
Date: 2026-09-14
Anchor: 2026-09-14 — `/unfreeze` may run as two sessions where the launching tool can't switch tier mid-session
Status: accepted
StatedIn: unit/document/agents-md § The design freeze, unit/command/unfreeze § Split across sessions

## Claim
`/unfreeze` ordinarily runs its reconcile phase (deep reasoning) and its track phase
(implementation) in one session, per `AGENTS.md` § *Session boundaries*' general rule that a
stage producing an artifact hands off through that artifact, not through carried context. Where
the launching tool cannot change tier mid-session — Codex, whose profiles are fixed for a
process's lifetime — the run splits into two sessions instead: session 1 covers *Refuse if not
frozen*, Phase 1, Phase 2, and *Commit*; session 2 covers Phase 3 and *Report*. `Commit` always
commits the marker's deletion, whether or not reconciliation touched `design/`, so the split
always has a handoff to read. `tools/Invoke-CodexCommand.ps1` already chains two `codex`
processes this way (issue #253); its two prompts now cite `unfreeze.md` § *Split across
sessions* instead of restating the procedure and report shape a second time.
