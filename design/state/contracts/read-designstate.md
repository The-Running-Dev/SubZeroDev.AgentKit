# contract/read-designstate
Status: active
Owner: unit/script/read-designstate
Declaration: tools/Read-DesignState.ps1

## Semantics
Emits the graph on the success stream and never throws for a malformed state set: a parse
failure is data (`Failures`), not an exception. Never skips a line — every line is either
matched by a production or reported (I24). Reads. Writes nothing, ever (I18). An absent
`design/state/` is a graph with `Root` empty and zero records, not an error — deciding what
absence means is the checker's, not the reader's. Invoked as a script, not imported as a
module, because `INSTALL.md` and `tools/Sync-Kit.ps1` both treat `tools/*.ps1` as the kit-owned
glob and a `.psm1` would not ship.
