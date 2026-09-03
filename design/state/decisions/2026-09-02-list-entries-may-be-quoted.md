# decision/2026-09-02-list-entries-may-be-quoted
Date: 2026-09-02
Anchor: 2026-09-02 — A list entry may be quoted, so a `StatedIn` site can name a heading that contains a comma
Status: accepted
StatedIn: unit/document/design-20-contract § Persisted schemas

## Claim
A list entry wrapped in double quotes may contain the list separator. The quotes are stripped and nothing else changes: a quoted and an unquoted entry naming the same id or site are one fact, and no class treats them differently. It is one rule for every list field, not a `StatedIn` form of its own. A quoted entry containing a double quote of its own is unparseable — there is no escape, because nothing in this repository needs one. The contract carries the production ahead of the reader as a scaffold; the slice that lands it in `tools/Read-DesignState.ps1` replaces the scaffold with a pointer and absorbs the three decisions S24 left in `unit/document/agents-md`'s `Live` for want of it.
