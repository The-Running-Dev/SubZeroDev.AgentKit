# decision/2026-09-15-agents-md-splits-into-shared-and-project
Date: 2026-09-15
Anchor: 2026-09-15 — AGENTS.md splits into a shared contract and a project part
Status: accepted
StatedIn: unit/document/project-agents-md § Shared contract

## Claim
The agent contract is two files. `AGENTS.shared.md` holds every rule a repository using the kit
shares, and ships from the kit install; each repository's own `AGENTS.md` holds only its project
rules and a pointer telling the session to read the shared file completely first. The kit is also
a project, so its root `AGENTS.md` keeps its own part — the `videos/` convention, the Videowright
instance of a declared region, and the Videowright-written block. `unit/document/agents-md` keeps
its id and moves its anchor to the shared file; the project part is a new unit.
