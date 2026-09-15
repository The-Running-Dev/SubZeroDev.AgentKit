# decision/2026-09-15-twelve-commands-shorten-to-natural-names
Date: 2026-09-15
Anchor: 2026-09-15 — Twelve command names shorten to their natural-language form
Status: accepted

## Claim
Twelve of the kit's twenty-three commands rename to shorter, more natural names: `brief-check`→
`brief`, `contract`→`spec`, `freeze`→`hold`, `install-code-review-agent`→`install-review`,
`kit-help`→`help`, `kit-sync`→`sync`, `make-human-docs`→`docs`, `reconcile`→`align`, `refine`→
`tune`, `slices`→`plan`, `unfreeze`→`resume`, `verify`→`check`. Each renamed skill folder moves to
match; each command's `unit/command/*` record keeps its existing id and filename and moves only
its `Anchor`. `skills/resume/SKILL.md`'s own `Phase 2 — reconcile` heading is unaffected — it names
a phase, not the command.
