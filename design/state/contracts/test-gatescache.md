# contract/test-gatescache
Status: active
Owner: unit/script/test-gatescache
Declaration: tools/Test-GatesCache.ps1

## Semantics
Never discovers a gate itself — that stays `/verify`'s judgement call, owned by `verify.md`. It
only remembers an answer `/verify` already worked out and says whether that answer is still
trustworthy, by comparing a stored manifest hash against one freshly computed from exactly the
inputs `verify.md`'s own discovery table reads: the content of every `.github/workflows/*.yml`
and of `package.json`, and the mere existence — never the content — of the known build-script
paths. A change to anything outside that fixed input list, such as a new `tools/*.Tests.ps1`
file, never invalidates the cache; widening the input list is a contract amendment, not a
judgement call this script makes on its own. `-Write` requires `-GatesJson` and persists it
alongside the current hash — it is meant to be called once, immediately after `/verify` performs
a real discovery pass by hand, never as a substitute for one. Emits `Status` of `Fresh`, `Stale`,
`Missing`, or `Written` and carries no exit-code vocabulary at all: the object's `.Status` is the
only signal, and a caller must read it rather than branch on the process exit code.
