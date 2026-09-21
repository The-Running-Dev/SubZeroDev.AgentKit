---
name: design
description: Produce or revise the design doc from the brief
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/design/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `vocabulary`, `document-map`, `extra-steps`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
<!-- companion:declared:end -->

## Stop if `design/` is frozen

If `design/FROZEN.md` exists, **stop before doing anything else.** Report its `Frozen because` and `Lifts when` lines verbatim and write nothing. The rule and the marker's format live in `AGENTS.shared.md`, *The design freeze* — not restated here.

Read `design/00-brief.md`. Write `design/10-design.md`.

This is the stage where irreversible decisions get made. Data model, module boundaries and error semantics are expensive to change later; code is not. Spend the reasoning here.

## Premises, before anything is designed

Every design is built on readings of the brief that the brief does not state outright, and a
reading the user would have rejected is the cheapest thing on this page to catch — it costs a
line here and a whole document later. Before designing, emit those readings as a numbered list:

```
PREMISES:
1. <statement> — agree/disagree?
2. <statement> — agree/disagree?
```

Three to six, each one load-bearing: what the system is actually for, what it may assume about
its inputs, what scale it has to survive, what it is allowed to treat as someone else's problem.
**Not a summary of the brief.** A summary is agreed with reflexively, and agreement to something
the user already wrote proves nothing.

Then wait. A premise the user disagrees with is re-stated from their correction, not argued.

## Approaches, then stop

**Do not write `design/10-design.md` until the approach is approved.** Offer two or three, name
which you recommend, and say why — the plain-English statement of the *problem* comes before the
options, per `AGENTS.shared.md` § *Working with me*:

- **Minimal viable** — the smallest architecture that satisfies the brief, and what it gives up.
- **Ideal** — what this looks like with the current constraints relaxed, and what that costs.
- **Lateral** — a different framing of the problem, where one genuinely exists. Where it does
  not, say so; two real approaches beat three padded ones.

One short paragraph each: what it is, what it costs, what it forecloses.

**A clearly winning approach is still an approach decision.** The failure this gate exists to
prevent is not choosing badly between three — it is writing the recommendation into prose and
carrying on, so that by the time anyone reads the document the choice is already load-bearing in
six sections and expensive to revisit. Where one approach is obviously right, say so in a line,
and still stop.

Stop means stop: emit the approaches and end the turn.

Required sections, in this order:

## Data model
Entities, their fields with types, ownership, lifecycle, and identity. State which fields are derived and from what. State what is persisted vs in-memory.

## Module boundaries
Each module: what it owns, what it depends on, what it exposes. Draw the dependency direction explicitly and confirm it is acyclic.

## Control flow
The two or three main paths through the system, end to end, named by what triggers them.

## Distribution
How the thing reaches the people who use it. Where the deliverable is a new artifact — a CLI binary, a library, a package, a container image, a mobile app — state the channel, what a user does to get it the first time, and what an upgrade looks like. **Code with no distribution is code nobody can run**, and the install path is designed here or discovered in the last slice. Where the deliverable ships inside something that already exists, say so, and say what carries it.

## Failure modes
For each external dependency and each boundary: what can fail, how it is detected, what the system does, what the user sees. Include partial failure and retry semantics. Include what state is left behind on failure.

## Concurrency and ordering
What can happen simultaneously, what must not, and what enforces that. If the answer is "nothing is concurrent," say so and say what enforces it.

## Alternatives considered
At least three architectural choices where a different option was viable. For each: what was chosen, what was rejected, and the specific reason for rejection. **A section with no rejected alternatives means the decision was not actually made — go back and make it.** The approved approach belongs here too, with the approaches it beat.

## Open questions
Things that cannot be resolved without information I have not given you. Ask them here rather than assuming.

Rules:
- No code. No file layouts. No package names beyond what a decision required.
- Every decision that survives goes into `design/90-decisions.md` in the logged format. Where this repository's own `design/state/` exists, writing it also follows the record-writing sequence in `AGENTS.shared.md` § *Writing a design-state record* — not restated here.
- If the brief is too thin to design against, stop and say what is missing rather than inventing requirements.

## Hand off

`design/10-design.md` is committed and the session ends. `/redteam` runs next, and
`AGENTS.shared.md` § *Session boundaries* makes this the strictest boundary the pipeline has:
fresh session **and a different vendor**, because a model recognises its own output distribution
and defends it. Emit the transfer block `AGENTS.shared.md` § *The session-transfer handoff block*
requires, then that boundary's banner.

Two things this one block must carry that a banner cannot:

- **`Start here` is `/redteam`, strongest model, different vendor from the design author** — the
  tier `AGENTS.shared.md` § *Command routing* fixes for it.
- **The different-vendor requirement goes in `Constraints`, in words.** It is the only constraint
  in the pipeline that the receiving session cannot check for itself — a fresh session of this
  same model reads as a clean start from the inside, which is exactly the failure.
- **`Authoritative inputs` names the committed path and its commit** — `design/10-design.md`,
  plus `design/00-brief.md` for what it was designed against. **Do not paste the design into the
  block, and do not summarise the arguments behind it.** Those arguments are precisely what the
  boundary exists to keep out of the reviewing session; a `Current state` that rehearses why an
  approach was chosen hands the red team the defence before it has read the design.

## Re-run

Rewrites `design/10-design.md` in full from the current brief — there is no partial
regeneration. Both gates run again: a brief that moved is exactly when a premise goes stale
without anyone noticing, and re-confirming one costs a line. An approach already approved and
still unchallenged by the brief is re-stated in one line rather than re-offered as a choice.
Check `design/90-decisions.md` before restating a choice; a decision already
logged there is not made fresh on a re-run, only re-expressed. `## Open questions` only ever
shrinks as the brief answers them — a question the brief now answers must not reappear.
