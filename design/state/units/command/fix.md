# unit/command/fix
Kind: command
Status: active
Anchor: .claude/commands/fix.md
Consumes:
Exposes: contract/fix
Binds: I6, I10, I11
Live: decision/2026-08-05-fix-is-a-new-command-files-own-bug-issue, decision/2026-08-08-pr-absorbs-gates-drafts-abolished, decision/2026-08-19-pr-real-description-at-open, decision/2026-08-20-fix-picks-its-own-bug-when-given-nothing
Archival:
Questions:
Work:
Evidence:

## Owns
Reproduces and fixes a defect that has no slice, from a bug issue number, a description, a failing test already in context, or — given none of those — the highest-value open bug it picks itself (I6).
