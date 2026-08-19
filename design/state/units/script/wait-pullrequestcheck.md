# unit/script/wait-pullrequestcheck
Kind: script
Status: active
Anchor: tools/Wait-PullRequestCheck.ps1
Consumes:
Exposes:
Binds: I2, I7, I8
Live:
Archival:
Questions:
Work:
Evidence: tools/Wait-PullRequestCheck.Tests.ps1

## Owns
Waits for a pull request's checks to reach a terminal state against a named head SHA, and
refuses to report an outcome at all if the head moved while it was watching.
