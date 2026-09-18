# unit/script/install-agentkit
Kind: script
Status: active
Anchor: tools/Install-AgentKit.ps1
Consumes:
Exposes:
Binds:
Live: decision/2026-09-15-install-agentkit-built
Questions:
Work:
Evidence: tools/Install-AgentKit.Tests.ps1

## Owns
Installs, updates, rolls back, and uninstalls the machine-wide `~/.agent-kit` checkout, creating
the host adapters or owned links that resolve canonical skills into each AI tool's personal skills
folder and managing Claude's session-cost hooks and each host's declared AgentKit pointer block,
tracked in `$HOME/.agent-kit-state/installed.json` so it only ever touches state it created itself.
