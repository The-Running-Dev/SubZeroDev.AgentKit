# decision/2026-09-19-a-fenced-marker-is-not-a-region
Date: 2026-09-19
Anchor: 2026-09-19 — A fenced marker is not a region, and the unclaimed-region check is deferred
Status: accepted
StatedIn: "unit/document/design-20-contract § Marked regions"

## Claim
A marker inside a fenced code block is not a marked region. Every document explaining the
mechanism has to show the marker, so a scanner that cannot tell an example from an instance
reports the documentation as the tree — and two command files carry such an example today. The
rule is contracted here; the scanner change that detects it is implementation and is filed
separately. Detecting a projected region no projector claims stays deferred, not pending: the
check needs the projector registry `§ Marked regions` already refused, on a reason nothing has
changed — a mistyped id in a registry goes unchecked silently, in the direction the check exists
to catch. The case that raised the question is separately answered, because a region a tool
outside the kit writes carries the declared form.
