# contract/test-designdrift
Status: active
Owner: unit/script/test-designdrift
Declaration: tools/Test-DesignDrift.ps1

## Semantics
Read-only against both sides: never edits `design/`, never edits an issue, and never opens or
closes one. Which side of a drift is wrong is the user's call — this script only establishes
that the two disagree. Exit codes: 0 no drift, 1 drift found, 2 could not evaluate; 1 and 2 are
different answers and must never collapse into each other — "the ids disagree" is a finding,
"`gh` is not authenticated" is the absence of one. A criterion id it cannot parse is reported as
unparseable, never silently dropped.
