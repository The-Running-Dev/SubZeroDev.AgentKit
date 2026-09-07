# decision/2026-09-07-videos-is-a-subproject-outside-the-corpus
Date: 2026-09-07
Anchor: 2026-09-07 — `videos/` is a Videowright subproject recorded as a dependency and kept outside the design-state corpus
Status: accepted
StatedIn: unit/document/agents-md § House conventions

## Claim
`videos/` is a Videowright subproject: a Node dependency tree, a dev-server entry in
`.claude/launch.json`, and a marked region in `AGENTS.md` the Videowright installer owns. It sits
outside the design-state corpus and outside every glob in `design/20-contract.md` § *Artifacts of
a unit kind*, holds no unit record, and contributes to no closure. The design's subject is the
design-state mechanism, and a glob reaching a few hundred files of Node toolchain the kit does
not own would put `GlobDisagreement` in permanent conflict with a directory nothing here
maintains. The dependency itself is patched in place after install and that patch does not
survive a fresh `npm install`.
