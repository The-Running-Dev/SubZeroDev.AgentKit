# decision/2026-09-18-stage-zero-gains-an-interview-command
Date: 2026-09-18
Anchor: 2026-09-18 — Stage 0 gains an interview command, and the brief gains two fields
Status: accepted
StatedIn: "unit/command/interview § What this command is not", "unit/command/interview § The five questions", "unit/document/template-00-brief § What we do instead today (and what it costs)", "unit/document/template-00-brief § Narrowest useful version", "unit/document/agents-md § Command routing", "unit/document/agents-md § The design freeze", "unit/document/agents-md § Verification", "unit/document/agents-md § Output discipline", "unit/document/agents-md § Working with me"

## Claim
Stage 0 gains `/interview`, the first command for the one stage that had none. It conducts the
interrogation that produces `design/00-brief.md` and types the file; it may not originate the
problem, a non-goal, or a definition-of-done criterion, and a field with no answer is written
empty and reported as empty. Five questions, asked one at a time with a stated escape hatch, then
a numbered premise list for agreement, then the three remaining fields drafted from the answers
and signed off one at a time. `templates/design/00-brief.md` gains the two fields the new
questions fill — the current workaround and its cost, and the narrowest version worth having this
week. Authoring the brief is gated by the design freeze on the same terms as `/design`, `/spec`
and `/plan`, so the six gated commands become six. Three rules land in `AGENTS.shared.md` in the
same change: a claimed limitation needs evidence before it may shape anything; a fork is
explained in plain English before its options are listed, with completeness stated as
information rather than as a ranking; and this repository's own vocabulary is glossed on first
use, including a term the user typed first.
