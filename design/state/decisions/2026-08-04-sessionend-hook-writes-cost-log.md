# decision/2026-08-04-sessionend-hook-writes-cost-log
Date: 2026-08-04
Anchor: 2026-08-04 — A `SessionEnd` hook writes a cost log, and installs may write that one key
Status: accepted

## Claim
`Measure-Session.ps1 -Hook` reads the `SessionEnd` hook's JSON from stdin and writes one row per session to `.claude/session-costs.tsv`, gitignored, idempotent by session id since `SessionEnd` also fires on clear and resume. `INSTALL.md` gains a bounded exception permitting installs to write the `hooks.SessionEnd` key for this hook only, refused outright if a `SessionEnd` hook already exists.
