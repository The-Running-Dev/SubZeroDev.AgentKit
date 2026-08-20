# unit/script/update-designprojection
Kind: script
Status: active
Anchor: tools/Update-DesignProjection.ps1
Consumes: contract/read-designstate
Exposes: contract/update-designprojection
Binds: I14, I25, I29
Live:
Archival:
Questions: question/slices-authority-home, question/answered-question-unit-edge
Work:
Evidence: tools/Update-DesignProjection.Tests.ps1

## Owns
The projector: renders `design/state/` records into marked regions, writing only between the
markers of a projected region.
