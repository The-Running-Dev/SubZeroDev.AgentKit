# contract/update-designprojection
Status: active
Owner: unit/script/update-designprojection
Declaration: tools/Update-DesignProjection.ps1

## Semantics
`-DryRun` renders to the success stream and writes nothing — this is the checker's entry point.
Writes only between the markers of a projected region: never a byte outside a region, never a
new region, never a file that has no region in it, and never inside a declared region (I18,
I29). Idempotent and order-independent (I25) — regenerating twice produces identical bytes, and
regenerating one region never changes what another renders to. Never reads a rendered region
(I14) — input is records, output is regions, and there is no path back. Refuses an unbalanced or
nested region rather than repairing it, and reports which document and which marker.
