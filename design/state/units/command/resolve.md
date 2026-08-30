# unit/command/resolve
Kind: command
Status: active
Anchor: .claude/commands/resolve.md
Consumes: contract/wait-pullrequestcheck
Exposes: contract/resolve
Binds: I1, I5
Live: decision/2026-08-03-resolve-classifies-in-bulk-asks-on-ambiguous, decision/2026-08-19-resolution-batch-replaced-by-standing-delegation
Questions:
Work:
Evidence:

## Owns
Triages a pull request's review comments, fixes what is valid, and resolves the threads that fix satisfies.
