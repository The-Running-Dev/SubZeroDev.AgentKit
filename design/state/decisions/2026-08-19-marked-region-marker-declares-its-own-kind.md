# decision/2026-08-19-marked-region-marker-declares-its-own-kind
Date: 2026-08-19
Anchor: 2026-08-19 — A marked region declares in its own marker whether it is generated; the bare form means projected
Status: accepted
StatedIn: unit/document/agents-md § Marked regions

## Claim
A marked region's opening marker carries a fixed keyword distinguishing its two kinds: the bare form `<!-- <id>:start -->` means projected and is overwritten on every regeneration, and `<!-- <id>:declared:start -->` means hand-authored and is never written by the projector, though checked for presence and well-formedness the same way. The bare form means projected because `agent` blocks already exist unmigrated across eighteen repositories, while `companion` blocks migrate by being shipped. I29 records that the projector never writes inside a declared region and no id is both.
