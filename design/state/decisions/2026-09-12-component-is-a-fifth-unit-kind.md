# decision/2026-09-12-component-is-a-fifth-unit-kind
Date: 2026-09-12
Anchor: 2026-09-12 — `component` is a fifth unit kind, shipped fixed rather than declared per repository
Status: accepted
StatedIn: unit/document/design-10-design § Unit

## Claim
`component` is a unit kind alongside command, script, document and invariant: the kind an
application repository's tree has — an assembly, a module, a package. The vocabulary stays closed
in the reader. A repository declares what its components are, by writing the kind's glob in
`design/20-contract.md` § *Artifacts of a unit kind*, and never declares that the kind exists:
the kind segment of an id is parsed before any record is read, so a vocabulary learned from a
document would put a prose parse upstream of every record and give the reader a dependency it
does not have today.
