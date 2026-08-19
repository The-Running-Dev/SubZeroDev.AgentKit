# decision/2026-08-19-retirement-is-status-field
Date: 2026-08-19
Anchor: 2026-08-19 — Retirement is a `Status` field on `Unit` and `Contract`
Status: accepted

## Claim
Retirement is `Status: active | retired` on `Unit` and `Contract`, the same shape `Decision` and `Question` already carry. Retirement changes exactly two things — the record leaves every closure, and its `Anchor` is exempt from the tree check (I30) — and a live record naming a retired one is not a finding. The date of retirement is deliberately not a field, being recoverable from the record's own file history.
