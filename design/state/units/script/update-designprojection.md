# unit/script/update-designprojection
Kind: script
Status: active
Anchor: tools/Update-DesignProjection.ps1
Consumes:
Exposes:
Binds:
Live:
Archival:
Questions: question/slices-authority-home
Work:
Evidence: tools/Update-DesignProjection.Tests.ps1

## Owns
The projector: renders `design/state/` records into marked regions, writing only between the
markers of a projected region.
