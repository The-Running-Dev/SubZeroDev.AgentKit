# decision/2026-09-07-externally-written-region-is-declared
Date: 2026-09-07
Anchor: 2026-09-07 — A marked region written by a tool outside the kit is declared, and `videowright` is renamed to the declared form
Status: accepted
StatedIn: unit/document/agents-md § Marked regions

## Claim
A marked region written by a tool outside the kit carries the **declared** form. Nothing in this
repository projects such a region, so the bare form would promise a regeneration that never
happens, while presence-and-well-formedness checking is precisely what declared means. The
marker form is this repository's to assert even where an external installer owns the bytes and
may overwrite it; a re-install restoring the bare form is the finding recurring rather than the
rule changing. `AGENTS.md`'s `videowright` block is the first instance and is renamed
accordingly.
