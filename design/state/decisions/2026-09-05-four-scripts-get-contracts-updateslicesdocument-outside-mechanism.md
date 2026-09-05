# decision/2026-09-05-four-scripts-get-contracts-updateslicesdocument-outside-mechanism
Date: 2026-09-05
Anchor: 2026-09-05 — Four scripts crossing a module boundary get `Contract` records, and `Update-SlicesDocument.ps1` is declared outside the design-state mechanism
Status: accepted
StatedIn: contract/test-gatescache § Semantics, contract/test-verifyreport § Semantics, contract/test-writesurface § Semantics, contract/update-slicesdocument § Semantics

## Claim
`tools/Test-GatesCache.ps1`, `tools/Test-VerifyReport.ps1`, `tools/Test-WriteSurface.ps1` and
`tools/Update-SlicesDocument.ps1` each carry a `Contract` record — `Owner` the unit, `Declaration`
the script — closing the gap against § *Public surface*'s claim that a record exists for every
surface it names and for nothing else. `tools/Update-SlicesDocument.ps1` is not a module of the
design-state mechanism: its writes land in `design/30-slices.md`'s hand-authored structure,
outside any marked region by design, so I18 does not bind it.
