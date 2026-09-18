# unit/script/start-agentkitcodex
Kind: script
Status: active
Anchor: tools/Start-AgentKitCodex.ps1
Consumes:
Exposes:
Binds:
Live:
Questions:
Work:
Evidence: tools/Start-AgentKitCodex.Tests.ps1

## Owns
Starts the routed Codex mode from a JSON array of arguments. It invokes the existing Codex
launcher in the current terminal or, when requested on Windows, opens a visible PowerShell
terminal without reinterpreting the user arguments as shell text.
