# decision/2026-08-03-agent-block-points-where-doc-governs-and-is-fenced
Date: 2026-08-03
Anchor: 2026-08-03 — The agent block points where a document governs, and is fenced
Status: accepted
StatedIn: unit/document/agents-md § Tracking work

## Claim
An issue's agent block is fenced by `<!-- agent:start -->`/`<!-- agent:end -->` so a stale authority pin is fixable in bulk without destroying a ticked checkbox; it stays thin, naming only which slice, where authority lives, and out-of-scope, with procedure left to the command file. Authority is pinned to a commit, criteria carry stable ids that are never reused or renumbered, and `Delivers:` is required to be a real sentence rather than an invented label.
