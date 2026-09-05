# decision/2026-08-11-documents-state-only-what-tree-cannot
Date: 2026-08-11
Anchor: 2026-08-11 — Documents state only what the tree cannot, and descriptive drift is corrected where it is found
Status: accepted
StatedIn: unit/command/reconcile § What is no longer this command's, unit/document/agents-md § Single ownership

## Claim
`AGENTS.md`'s *Single ownership* rule binds doc-to-code, not only doc-to-doc: a document states only what the tree cannot, tested as "could a reader recover this fact by reading the tree?" `20-contract.md` correspondingly carries semantics rather than shape. A declaration, path, field name, or count that disagrees with the tree is corrected on the spot by the implementing slice, by named path, with no fork and no log entry; an invariant, non-goal, acceptance criterion, or public interface still stops and escalates. That power is `/slice`'s only, never `/fix`'s, and is inert while `design/FROZEN.md` exists. `/reconcile` is barred from `design/30-slices.md`, and a landed slice's body retires to an index there.
