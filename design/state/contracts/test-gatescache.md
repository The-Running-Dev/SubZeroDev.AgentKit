# contract/test-gatescache
Status: active
Owner: unit/script/test-gatescache
Declaration: tools/Test-GatesCache.ps1

## Semantics
Never discovers a gate itself — that stays `/check`'s judgement call, owned by
`skills/check/SKILL.md`. It only remembers an answer `/check` already worked out and says whether
that answer is still trustworthy, by comparing a stored manifest hash against one freshly computed
from exactly the inputs `/check`'s own discovery table reads: the content of every
`.github/workflows/*.yml` and of `package.json`, and the mere existence — never the content — of
the known build-script paths. A change to anything outside that fixed input list, such as a new
`tools/*.Tests.ps1` file, never invalidates the cache; widening the input list is a contract
amendment, not a judgement call this script makes on its own. `Fresh` needs a matching hash and at
least one cached gate: a cache whose gate list is empty or null carries no answer to reuse and is
`Stale`. `-Write` requires `-GatesJson` and persists it alongside the current hash — it is meant
to be called once, immediately after `/check` performs a real discovery pass by hand, never as a
substitute for one. Emits `Status` of `Fresh`, `Stale`, `Missing`, or `Written` and carries no
exit-code vocabulary at all: the object's `.Status` is the only signal, and a caller must read it
rather than branch on the process exit code.
