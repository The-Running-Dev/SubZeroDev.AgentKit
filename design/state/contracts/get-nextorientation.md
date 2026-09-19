# contract/get-nextorientation
Status: active
Owner: unit/script/get-nextorientation
Declaration: tools/Get-NextOrientation.ps1

## Semantics
Runs `/next`'s orientation reads without a model and returns their structured result, scoped to
`-RepoRoot` rather than the process's ambient directory. A failed `gh` pull-request query is
reported as unavailable, never as an empty pull-request list; an absent design gate is reported
as not present. Each result carries a plain-language `Summary` beside its declared fields, so a
caller can act without translating a boolean or exit code. Never chooses what runs next and never
opens a model session: that judgement remains with the person or session reading the orientation.
