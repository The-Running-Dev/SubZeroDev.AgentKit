# unit/command/pr
Kind: command
Status: active
Anchor: .claude/commands/pr.md
Consumes: contract/wait-pullrequestcheck, contract/resolve
Exposes:
Binds:
Live: decision/2026-08-03-pr-defers-to-repository-merge-convention, decision/2026-08-08-pr-absorbs-gates-drafts-abolished, decision/2026-08-19-pr-real-description-at-open
Questions:
Work:
Evidence:

## Owns
Takes the current branch's pull request to merge-ready: description, gates, then review threads.
