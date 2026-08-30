# decision/2026-08-22-done-always-hands-off-to-track
Date: 2026-08-22
Anchor: 2026-08-22 — `/done` always hands off to `/track`, and never runs it
Status: superseded
SupersededBy: decision/2026-08-30-derived-state-commits-to-default-branch

## Claim
`/done` ends every run with the session-boundary banner `AGENTS.md` § *Session boundaries* requires, naming `/track` as next — fresh session, `sonnet`/`medium` — and never runs `/track` itself. The banner is emitted even on a run that deleted nothing, because `/track` reconciles `design/` against the tracker and an empty candidate list says nothing about whether that reconciliation is owed. Two runs do not hand off: `Stopped: true`, and a run under `design/FROZEN.md`, where `/track` would refuse and the marker's `Frozen because` and `Lifts when` lines are reported instead. `.claude/commands/kit-help.md`'s slice loop runs `/done` then `/track` and no longer calls `/done` optional housekeeping. `AGENTS.md` is unchanged: the `merge → /track` boundary and its banner rule are leaned on rather than amended, and `/done` stays routed `haiku`/`low`.
