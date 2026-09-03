# decision/2026-08-08-sync-kit-built
Date: 2026-08-08
Anchor: 2026-08-08 — `tools/Sync-Kit.ps1` is built: the mechanism 2026-08-05 recorded but did not implement
Status: accepted
StatedIn: unit/document/install-md § Phase 1 — Classify, unit/document/install-md § Phase 4 — Apply

## Claim
`tools/Sync-Kit.ps1` implements the sha-based comparison recorded at `decision/2026-08-05-sync-kit-mechanism-recorded`: for every kit-owned path, three blobs — recorded, head, target — decide the outcome, with an unmatched target reported as `Divergent-Skipped` or `Collision-Skipped` and left alone. It adds a `-DryRun` mode and a separate `syncedCommit` field on `.claude/kit.json`, distinct from `commit`, so a partial sync cannot claim the whole kit is current.
