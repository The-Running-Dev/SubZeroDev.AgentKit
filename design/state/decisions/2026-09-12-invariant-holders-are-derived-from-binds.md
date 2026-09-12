# decision/2026-09-12-invariant-holders-are-derived-from-binds
Date: 2026-09-12
Anchor: 2026-09-12 — An invariant's holders are derived from `Unit.Binds`; `Invariant.Owner` is deleted
Status: accepted
StatedIn: unit/document/design-10-design § Invariant

## Claim
An invariant names no owner. `Unit.Binds` is the forward edge and `Invariant.BoundBy` is derived
from it, so an invariant held by zero, one, several, or every unit is expressible with no
cardinality rule and no written field. An empty `BoundBy` is not a finding — an invariant
enforced by nothing is a real state, on the line already drawn for questions rather than the one
drawn for decisions, where an empty `Affects` is an interrupted write. `Contract.Owner` is
unaffected and stays written: "exactly one owner" is a claim about the contract that a blocking
class checks against the exposing units, and an invariant makes no equivalent claim for a written
field to be checked against.
