# decision/2026-09-05-public-surface-check-asserts-correspondence-not-count
Date: 2026-09-05
Anchor: 2026-09-05 — The Public-surface self-check asserts the correspondence, never the count
Status: accepted

## Claim
`tools/Test-DesignState.Tests.ps1` S16.1/S16.2 parses `design/20-contract.md` § *Public surface* and asserts that correspondence in both directions rather than a record count: a surface entry is a `###` heading in that section whose text begins with a backticked path, each such path has exactly one active `Contract` record owned by the unit anchored there, and every active `Contract` record's owner is anchored at one of those paths. No cardinality appears in the assertion, so the section growing with its records stays green and either half growing alone does not.
