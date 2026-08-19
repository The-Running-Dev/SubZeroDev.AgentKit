# decision/2026-08-03-make-human-docs-generated-drift-checked
Date: 2026-08-03
Anchor: 2026-08-03 — `/make-human-docs` produces a generated guide, drift-checked by `/reconcile`
Status: accepted

## Claim
`/make-human-docs`'s guide is generated, carries a do-not-edit header naming `design/` as its source, and `/reconcile` reports only semantic divergence against it, never a byte diff. Exact signatures, schemas and error tables are linked to `20-contract.md`, never copied.
