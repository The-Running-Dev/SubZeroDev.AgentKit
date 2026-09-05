# unit/command/pr
Kind: command
Status: active
Anchor: .claude/commands/pr.md
Consumes: contract/wait-pullrequestcheck, contract/resolve, contract/test-verifyreport
Exposes:
Binds:
Live: decision/2026-08-03-pr-defers-to-repository-merge-convention
Questions:
Work:
Evidence:

## Owns
Takes the current branch's pull request to merge-ready: description, gates, then review threads.
