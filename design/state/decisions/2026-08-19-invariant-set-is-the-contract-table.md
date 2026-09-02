# decision/2026-08-19-invariant-set-is-the-contract-table
Date: 2026-08-19
Anchor: 2026-08-19 — The invariant unit set is the whole of § *Invariants*, not the ids some document quotes
Status: accepted
StatedIn: unit/document/design-20-contract § Documents that carry surface

## Claim
The invariant unit set is every `I<n>` row in `design/20-contract.md` § *Invariants*, not the ids cited in `AGENTS.md` or a command file. A rule the kit binds itself to is a unit whether or not any document quotes its number. The checker parses that section rather than scanning for citations, which makes the contract document the second parsed list it is canonical for; `ContractListUnreadable` covers both, and an unreadable section leaves `UnrecordedArtifact`'s invariant half uncomputed rather than empty.
