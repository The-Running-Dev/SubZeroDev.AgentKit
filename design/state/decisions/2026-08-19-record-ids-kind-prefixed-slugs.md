# decision/2026-08-19-record-ids-kind-prefixed-slugs
Date: 2026-08-19
Anchor: 2026-08-19 — Record ids are kind-prefixed slugs, with `I<n>` the one exception
Status: accepted

## Claim
Every record id is a kind-prefixed slug — `unit/<kind>/<slug>`, `contract/<slug>`, `decision/<YYYY-MM-DD>-<slug>`, `question/<slug>`, `work/<issue>` — except `I<n>`, which stays bare because those numbers are already cited throughout `AGENTS.md`, several command files, and the decision log, and prefixing them would be the corpus-wide rename permanent ids exist to prevent. The id determines the record's own file path and only its own, so a record in the wrong file cannot be addressed at all.
