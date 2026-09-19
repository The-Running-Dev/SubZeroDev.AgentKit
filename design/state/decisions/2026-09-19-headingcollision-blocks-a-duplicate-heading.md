# decision/2026-09-19-headingcollision-blocks-a-duplicate-heading
Date: 2026-09-19
Anchor: 2026-09-19 — `HeadingCollision` blocks a duplicate heading before any site names it
Status: accepted
StatedIn: "unit/document/design-20-contract § The divergence classes"

## Claim
`SiteAmbiguous` catches a heading that resolves more than once, but only once a site names it — so
a file with two identical headings is silently fine until the first pointer is written into it, at
which point the author is told a count and not a cause. `HeadingCollision` is that check moved one
step earlier: a new blocking class, raised when a file a `StatedIn` site can name carries two
headings with the same resolvable text. Its scope is exactly the files a site can name and
deliberately no wider, because a collision in a file no pointer could reach is noise in the one
list that must stay actionable. It is its own id rather than a widening of `SiteAmbiguous`,
because changing what an existing class detects without changing its id is the divergence
`ClassListDisagreement` cannot see. It blocks on I22's own terms — a string comparison over the
checkout, no network, no tracker, no running service.
