# decision/2026-08-05-seed-moves-to-templates-design
Date: 2026-08-05
Anchor: 2026-08-05 — The seed moves to `templates/design/`, and `design/` becomes the repository's own everywhere
Status: accepted

## Claim
The kit's seed templates move to `templates/design/`; `design/` means the repository's own design docs everywhere, including in the kit itself. Moving the templates rather than the kit's own `design/` changes zero command files, since every command that touches a design document already hardcodes that path.
