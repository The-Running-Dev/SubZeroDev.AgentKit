---
name: design
description: Produce or revise the design doc and its contract from the brief
disable-model-invocation: true
---


Read `design/00-brief.md`. Write `design/10-design.md`, then `design/20-contract.md`.

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
which you recommend, and say why — a plain-English statement of the *problem* comes before the
options:

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
- Every decision that survives goes into `design/90-decisions.md`: date, decision, context, what was chosen, what was rejected and why.
- If the brief is too thin to design against, stop and say what is missing rather than inventing requirements.

## Then the contract

Once `design/10-design.md` is written, write `design/20-contract.md` from it in the same run. It is what `/next` builds against, so precision here is what lets the build run without stopping.

- **Invariants** — statements that must always hold, written so they could become assertions, each naming the module that maintains it. Write this section first; it is the most valuable one.
- **Public surface** — every function, command or endpoint crossing a module boundary: inputs, outputs, what a caller may rely on, what it must never do. Before the code exists, give declarations in the project's language, signatures only.
- **Persisted schemas** — tables, collections or files, with keys and constraints, and what happens to existing data.
- **Error semantics** — per module, each error: when it is raised, whether it is retryable, what the caller does. No bare exceptions, no string errors.
- **Unresolved** — any signature the design does not determine. Do not invent one; list it here.

The contract is written once. When the code later departs from it, the pull request says so; the contract is not kept in sync (`AGENTS.shared.md` § *The design is the spec*).

## When done

Report in the `AGENTS.shared.md` § *Reporting* shape. `Next:` is `/plan`. `/redteam` is optional before it — best run by a different vendor than this session's, and it is the user's call, not a gate.

## Re-run

Rewrites `design/10-design.md` and `design/20-contract.md` in full from the current brief — there is no partial
regeneration. Both gates run again: a brief that moved is exactly when a premise goes stale
without anyone noticing, and re-confirming one costs a line. An approach already approved and
still unchallenged by the brief is re-stated in one line rather than re-offered as a choice.
Check `design/90-decisions.md` before restating a choice; a decision already
logged there is not made fresh on a re-run, only re-expressed. `## Open questions` only ever
shrinks as the brief answers them — a question the brief now answers must not reappear.
