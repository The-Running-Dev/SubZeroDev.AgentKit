# decision/2026-09-12-videos-is-gated-but-not-rendered
Date: 2026-09-12
Anchor: 2026-09-12 — `videos/` is gated by its own CI job, and rendering is knowingly outside that gate
Status: accepted
StatedIn: unit/document/agents-md § House conventions

## Claim
Sitting outside the design-state corpus and sitting outside CI are separate facts, decided
separately. `videos/` is reached by one CI job and nothing else, and that job stops short of
rendering: a clean checkout is proven to install — which is where the `postinstall` patch risk
lives, and what made the subtree's ungated state worth closing — and is never proven to produce a
video. The corpus boundary is unchanged: no unit record, no glob widened, no closure contribution.
