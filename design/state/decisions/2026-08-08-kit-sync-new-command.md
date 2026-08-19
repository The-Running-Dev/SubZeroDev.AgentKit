# decision/2026-08-08-kit-sync-new-command
Date: 2026-08-08
Anchor: 2026-08-08 — `/kit-sync` is a new command: a shared `~/.agent-kit` checkout, updated then reconciled
Status: accepted

## Claim
`.claude/commands/kit-sync.md` maintains a single shared checkout at `~/.agent-kit`, fast-forwarded on later runs and never reset, with the branch remembered as a field on `.claude/kit.json`. Once current, it reads `INSTALL.md` from that checkout and follows it exactly against the current repository, inheriting every classification and the phase 3 sign-off gate rather than restating them.
