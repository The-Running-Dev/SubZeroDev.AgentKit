# unit/script/get-agentkitskill
Kind: script
Status: active
Anchor: tools/Get-AgentKitSkill.ps1
Consumes:
Exposes:
Binds:
Live:
Questions:
Work:
Evidence: tools/Install-AgentKit.Tests.ps1

## Owns
Reads one canonical command skill deterministically and makes only its kit-owned dependencies
absolute to the runtime checkout. It leaves project-owned paths, including companions and design
files, relative to the working repository.
