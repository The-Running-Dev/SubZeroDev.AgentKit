# decision/2026-09-19-align-commissions-the-semanticdisagreement-reading
Date: 2026-09-19
Anchor: 2026-09-19 — `/align` commissions the `SemanticDisagreement` reading
Status: accepted
StatedIn: "unit/document/design-20-contract § The divergence classes", "unit/command/reconcile § SemanticDisagreement", "contract/test-designstate § Semantics"

## Claim
`SemanticDisagreement` was declared in the reported class list, described in two design documents,
and raised by nobody — so the row described a check nothing performed, which reads as coverage to
exactly the caller looking for what checks a record's prose. `/align` commissions it, as a reading
rather than a script assertion, over the records its `LiveAlreadyStated` pass already opened: the
active units carrying a non-empty `Live`, plus the contracts and invariants reached in doing so.
That scope is what makes the reading affordable, and it is stated in the contract rather than left
to the command, because a class whose cost is unbounded is one that gets skipped in practice and
reported as clean. A record outside that set is not examined and the report says so. The class
stays permanently reported and never blocking, for the reason it always was: a build that fails on
a model's opinion is a build nobody trusts.
