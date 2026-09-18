# unit/command/pr
Kind: command
Status: active
Anchor: skills/pr/SKILL.md
Consumes: contract/wait-pullrequestcheck, contract/resolve, contract/test-verifyreport, contract/merge-pullrequest
Exposes:
Binds:
Live:
Questions:
Work:
Evidence:

## Owns
Takes the current branch's pull request to merged: description, gates, review threads, then the
merge itself once every gate is confirmed green.
