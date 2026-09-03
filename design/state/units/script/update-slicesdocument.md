# unit/script/update-slicesdocument
Kind: script
Status: active
Anchor: tools/Update-SlicesDocument.ps1
Consumes:
Exposes:
Binds:
Live:
Questions:
Work:
Evidence: tools/Update-SlicesDocument.Tests.ps1

## Owns
Retires a landed slice's full body out of `design/30-slices.md` § *Outstanding*, into a row
under § *Landed* (issue #120). Read-only against the tracker; never opens, closes, or edits an
issue.
