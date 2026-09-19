# unit/script/invoke-housekeeping
Kind: script
Status: active
Anchor: tools/Invoke-Housekeeping.ps1
Consumes: contract/invoke-donehousekeeping
Exposes: contract/invoke-housekeeping
Binds:
Live:
Questions:
Work:
Evidence: tools/Invoke-Housekeeping.Tests.ps1

## Owns
The no-model invocation path for `/clean`'s mechanical half: discovers candidates via
`tools/Invoke-DoneHousekeeping.ps1`, deletes every one that run confirmed, and reports
`Escalate:true` without deciding anything the moment a judgement case appears. Its printed
report states each fact as a sentence rather than a bare boolean
([[decision/2026-09-14-output-discipline-states-plain-language-first]]); the returned object's
fields are unchanged.
