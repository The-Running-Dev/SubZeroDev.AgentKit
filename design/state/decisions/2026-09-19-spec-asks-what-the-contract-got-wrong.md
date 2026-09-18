# decision/2026-09-19-spec-asks-what-the-contract-got-wrong
Date: 2026-09-19
Anchor: 2026-09-19 — `/spec` asks what the contract got wrong before the session ends
Status: accepted
StatedIn: "unit/command/contract § Before the session ends, ask what it got wrong"

## Claim
`/spec` closes with one turn asking what the contract got wrong, because `design/20-contract.md`
constrains every implementing session and is the one stage-two artifact nothing reviews — `/redteam`
attacks the design, and a session boundary falls immediately behind this command, so the first
thing to test the contract is a slice implementing against it, by which point a wrong invariant is
in code and correcting it is an amendment rather than an edit. The turn asks three things: where
`design/10-design.md` permitted more than one reading and this run picked one, named by section
with both readings; what was asserted beyond what the design implied, which already owes a
decision-log entry and is here stated before being written rather than found afterwards; and what
sits in `## Unresolved` with what each entry blocks. An empty list is an answer and is not padded.
It is one turn and not a loop, so the command can still hand off, and an amendment the answer
forces is made in that run rather than deferred to the slice that would trip over it.
