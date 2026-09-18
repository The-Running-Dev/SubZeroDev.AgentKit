# decision/2026-09-18-force-push-and-history-rewrite-are-no-longer-prohibited-outright
Date: 2026-09-18
Anchor: 2026-09-18 — Force-push and history rewrite are no longer prohibited outright
Status: accepted
StatedIn: "unit/document/agents-md § Git and delivery"

## Claim
*Git and delivery* no longer states "Never force-push or rewrite published history." as an
absolute rule. Whether to force-push is left to ordinary judgement per action: safe on an
unmerged feature branch nobody else is building on, unsafe on a branch others have pulled. `main`
is still reached only through the pull-request and merge-when-green delegation the same section
already describes; nothing about how commits land on the default branch changes.
