# decision/2026-09-19-script-unit-without-a-contract-acquires-one
Date: 2026-09-19
Anchor: 2026-09-19 — A script unit exposing no contract acquires one rather than an exemption
Status: accepted
StatedIn: "unit/document/design-20-contract § The state set"

## Claim
A script unit with no contract record has nowhere for a decision to be absorbed into, because a
site resolves a heading and a `.ps1` has none. The answer is a contract record for that script,
not a new site form and not an exemption: a decision landing on a script with nowhere to absorb
into is a script whose surface was never recorded, and each script carrying this today exposes
something another part of the kit already depends on by name. The two alternatives were refused
for what each costs the check — a site naming a headingless artifact leaves `SiteAmbiguous`
nothing to resolve against, trading a checked pointer for an unchecked claim at the one place the
reach rule exists to hold; and an accepted exemption leaves a `Live` set asserting *in flight*
about a decision that shipped, monotonically, with `ClosureOverBudget` as its only bound. Writing
the missing records is a separate slice, and this decision commissions it rather than running it.
