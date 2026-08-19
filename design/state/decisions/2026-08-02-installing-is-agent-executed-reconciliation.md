# decision/2026-08-02-installing-is-agent-executed-reconciliation
Date: 2026-08-02
Anchor: 2026-08-02 — Installing is an agent-executed reconciliation, not a script
Status: accepted

## Claim
`INSTALL.md` is a procedure written for an agent, not a script: classify every artifact as absent, identical, divergent, or occupied, propose a resolution per divergence, stop for sign-off, then apply and log. `.claude/commands/install.md` is a thin locator that reads it, so `/install` and a direct read of `INSTALL.md` follow the same procedure.
