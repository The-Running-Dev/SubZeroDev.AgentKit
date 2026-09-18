# unit/script/merge-pullrequest
Kind: script
Status: active
Anchor: tools/Merge-PullRequest.ps1
Consumes: contract/wait-pullrequestcheck
Exposes: contract/merge-pullrequest
Binds: I32
Live:
Questions:
Work:
Evidence: tools/Merge-PullRequest.Tests.ps1

## Owns
Merges a pull request only when every merge precondition is independently confirmed green against
a named head SHA, and refuses — never asks — when any one of them is not.
