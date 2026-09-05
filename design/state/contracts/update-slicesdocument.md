# contract/update-slicesdocument
Status: active
Owner: unit/script/update-slicesdocument
Declaration: tools/Update-SlicesDocument.ps1

## Semantics
For every `### S<n> — <name>` section under `design/30-slices.md` § *Outstanding*, looks up a
tracker issue whose title begins `S<n> ` — the same match `Test-DesignDrift.ps1` uses — open or
closed. A slice with no issue, or an open one, is left exactly as found: that is not a finding,
since `/track` is what opens a missing issue and closing early is not this script's call. A slice
with a closed issue is retired — its full section removed from § *Outstanding*, and a row naming
its number, name, the closed issue, the min–max range of every `S<n>.<m>` id in its `Acceptance:`
block, and the short SHA of the last commit that touched the file, appended to § *Landed*. It
never touches the document's hand-authored prose — the overview blockquote, a slice's narrative
preamble, or the "What each delivered" list — because none of that is derivable from the tracker;
a session running it still has to read what is left and correct any of that prose the retirement
made stale, by hand, in the same commit. Read-only against the tracker: never opens, closes, or
edits an issue. `-DryRun` reports what would be retired without writing the file. **It is not a
module of the design-state mechanism.** Its writes are to `design/30-slices.md`'s hand-authored
document structure, entirely outside any marked region — that is how the document is kept by
design, not a gap I18 leaves open, and I18 binds only the modules `design/10-design.md`
§ *Module boundaries* names.
