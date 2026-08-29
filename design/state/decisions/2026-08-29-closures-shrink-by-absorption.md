# decision/2026-08-29-closures-shrink-by-absorption
Date: 2026-08-29
Anchor: 2026-08-29 — Closures shrink by absorption: a decision edge retires into the artifact that states it, and an answered question retires too
Status: superseded
SupersededBy: decision/2026-08-29-retired-halves-to-companion-absorption-to-decision

## Claim
Retirement is relocation, never deletion, and a `Unit` record carries three retired halves — `Archival` for superseded decisions, `Absorbed` for decisions whose terms the unit's own artifact now states, and `Answered` for questions that no longer block. All three are excluded from the orientation closure and none carries a date. An `Absorbed` entry qualifies a decision id with a heading in that unit's own `Anchor`, which must resolve to exactly one heading; absorption is true of a (unit, decision) pair, so `Decision.Status` keeps its two values. `Decision.Affects` derives from all three decision halves and `Question.Affects` from both question halves.
