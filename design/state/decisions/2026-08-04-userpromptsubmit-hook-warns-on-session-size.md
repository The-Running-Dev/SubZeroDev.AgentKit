# decision/2026-08-04-userpromptsubmit-hook-warns-on-session-size
Date: 2026-08-04
Anchor: 2026-08-04 — A `UserPromptSubmit` hook warns on session size, and the install exception widens to two events
Status: accepted

## Claim
`Measure-Session.ps1 -Watch` runs as a `UserPromptSubmit` hook, printing one line once the current context crosses `-WarnAtTokens` and staying silent below it; the warning is injected as context so the model reads it too, and the hook always exits 0. `INSTALL.md`'s bounded hook exception widens from one event to two under the same sign-off and refusal-on-collision conditions.
