# decision/2026-08-02-design-docs-default-to-design-dir
Date: 2026-08-02
Anchor: 2026-08-02 — Design docs default to `design/`, not `docs/design/`
Status: accepted
StatedIn: unit/document/install-md § `design/` — check the path before anything else

## Claim
The kit's own design directory is `design/`, not `docs/design/`, referenced consistently across the commands and the standing documents. `INSTALL.md` explains why root is the default and checks only whether `design/` is already occupied.
