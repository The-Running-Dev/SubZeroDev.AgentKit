# unit/script/test-companion
Kind: script
Status: active
Anchor: tools/Test-Companion.ps1
Consumes:
Exposes: contract/test-companion
Binds:
Live:
Questions:
Work:
Evidence: tools/Test-Companion.Tests.ps1

## Owns
Validates the core/companion split in a repository's `.claude/commands/` directory, including
that a companion block is the declared marked-region form.
