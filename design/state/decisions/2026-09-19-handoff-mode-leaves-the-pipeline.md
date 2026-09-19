# decision/2026-09-19-handoff-mode-leaves-the-pipeline
Date: 2026-09-19
Anchor: 2026-09-19 — Handoff mode leaves the pipeline, and is declared in plain words
Status: accepted
StatedIn: "unit/document/agents-md § Handoff mode", "unit/command/handoff § What this command is for"

## Claim
The kit had no path for work that is specified but not designed, so every such ask was pushed
through `/brief` → `/design` → `/spec` → `/plan` → `/slice`, and the sessions doing the pushing were
reading the contract correctly: `AGENTS.shared.md` made `design/` outrank everything, bound
non-goals from a brief the work had none of, and forbade a public interface absent from a contract
nobody had written. The escape is therefore a section of the contract rather than a command that
contradicts it — a command alone loses, because the contract loads in every session and the command
does not. `AGENTS.shared.md` § *Handoff mode* names what is suspended (the pipeline, the
design-protecting hard rules, the tier gate, one-at-a-time sign-off) and what survives
(verification, git and delivery, destructive and external authorization, house conventions,
third-party text) — the split being that a suspended rule protects a design and a surviving one
separates finished work from claimed work. **It is declared in whatever words the user likes**, not
only by `/handoff`, because the failure being fixed is a session that keeps proposing pipeline
stages after being told in plain English to stop; a mode reachable only by a slash command would
not have caught any instance of it. A handoff contradicting `design/` is stated in the pull request
and left alone, the same disposition *The design freeze* already gives a contradiction found while
frozen.

An independent review of the same problem, run on a different vendor's deep-reasoning tier, was
folded in before this landed. What it contributed is the part a single author reliably omits: the
structured `Execution: direct` directive that takes precedence over inference, the five-row
precedence ladder that stops a handoff being read as outranking safety, the six named
covert-reintroduction sentences, and the observation that one-slice-at-a-time protects the *user*
rather than the design and therefore must survive the suspension — which this author had wrongly
suspended. What it proposed and this repository cannot take is an `executionMode` runtime flag
guarding a workflow engine: there is no runtime here, a `SKILL.md` is Markdown loaded into a model
(`design/20-contract.md` § *Artifacts of a unit kind*), and a flag no process reads is a mechanism
that cannot fail and therefore cannot be relied on. `tools/Test-HandoffMode.Tests.ps1` is the
mechanizable residue that request does have — the section's presence, its position ahead of
*Source of truth*, and the completeness of both lists. Its persistent global-config form was
rejected for the reason the freeze was: a durable switch with no lift step.

A second pass over the combined handoff added the one piece the first integration had missed: the
review's demand that every gate consult **one** authoritative answer rather than each re-deciding
whether the user meant it. Six sections — *Source of truth*, *Model, effort, and review budget*,
*Hard rules*, *The design freeze*, *Working with me*, *Tracking work* — now open with a pointer at
*Handoff mode* and decide nothing themselves. **A pointer is not the per-rule carve-out this
decision rejected.** A carve-out restates the exemption in each place and gives it eight homes to
drift between; a pointer states nothing and names the one home, which is *Single ownership* applied
to a gate rather than to prose. The failure it forecloses is specific and would otherwise be
invisible: a mode honoured at `/slice` and re-litigated at `/track` is indistinguishable, from the
user's side, from a mode that was never built.
