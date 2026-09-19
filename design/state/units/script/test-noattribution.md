# unit/script/test-noattribution
Kind: script
Status: active
Anchor: tools/Test-NoAttribution.ps1
Consumes:
Exposes:
Binds:
Live:
Questions:
Work:
Evidence: tools/Test-NoAttribution.Tests.ps1

## Owns
Fails a commit range that carries an AI-attribution line, as the CI-side half of the
no-AI-attribution rule (issue #340) - `tools/git-hooks/commit-msg` strips these locally,
and this is the gate that catches a commit made without that hook installed.
