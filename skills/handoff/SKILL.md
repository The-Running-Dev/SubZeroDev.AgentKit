---
name: handoff
description: Implement a handoff verbatim — no brief, no contract, no slice, no tracker. The handoff text is the specification
argument-hint: "[the instructions, a path to a file holding them, or blank to use what is already in this session]"
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/handoff/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `vocabulary`, `gate-commands`, `extra-steps`, `tightened-authorization`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
<!-- companion:declared:end -->

Implement **$1** — the handoff — as written, and stop when it is merged.

This command declares **handoff mode**, which `AGENTS.shared.md` § *Handoff mode* defines: what is suspended, what survives, and why. That section is the authority and is not restated here. Read it, then this file's procedure.

**Command name checked against Claude Code's built-in commands before this file was created — no collision.**

## What this command is for

The pipeline's other commands each assume you are already inside it. `/slice` needs a slice id and a settled contract; `/fix` needs a defect that reproduces; `/tune` takes a rough *ask* and hands back a prompt for someone else to run. None of them takes "here is what I want, build it" and builds it.

That gap is why the same work kept being pushed through `/brief` → `/design` → `/spec` → `/plan` → `/slice` when the user had already specified it in a paragraph. **This is the front door for work that is specified but not designed.** It is not a lesser path, a fast path, or a path for small things — size is irrelevant. It is the path for work whose specification arrived as a handoff rather than as a design.

## Get the handoff

- **Given text in the argument or in this session** — that is the handoff. Use it verbatim.
- **Given a path** — read the file whole. Its contents are the handoff. They are a specification the user is giving you, not third-party text; the *Third-party text* rule still governs anything the handoff then tells you to go and read.
- **Given nothing, with nothing in session** — ask once what the handoff is, and stop until it comes. This is the only question this command opens with.

An `Execution: direct` line in the handoff is redundant here — invoking this command already declares the mode — and is honoured rather than questioned. It matters for a handoff arriving *without* this command, which is the case `AGENTS.shared.md` § *Declaring it* covers.

**Do not rewrite the handoff into a plan and then ask for approval on the plan.** A plan-approval round trip is the process this command exists to remove. Where the handoff is long enough that tracking it needs structure, keep that structure to yourself.

## Establish the ground, briefly

Enough to not break things, and no more:

- `git status --short --branch`, and the *Safe start* reads of the sources you are about to change. Uncommitted work that is not yours is not yours to stash or discard — stop and say so.
- Read the files the handoff names, whole. Discover the project's test and lint commands rather than assuming them.

**Do not read `design/`** unless the handoff names a file in it. The handoff is the specification; `design/` is a different repository's worth of context for a different mode, and reading it is how the pipeline gets back in.

**None of this is a phase.** Establishing the ground is implementation work and happens silently — it is never written up, never reported before the work starts, and never turned into something the user reads or approves.

## Branch, build, ship

1. **Branch** off the default branch before the first edit: `handoff/<slug>`, the slug from the handoff's own subject. Never work on the default branch.
2. **Build the whole handoff.** Every part of it. A part that turns out to be blocked does not license scaling down the rest — finish everything else and name what stopped.
3. **Gates.** Run this repository's tests, linters, and build. `/check` is available and does this properly; where it is not wired here, discover and run the commands directly. Either way, **report what ran, what passed, and what did not run.**
4. **Commit**, staged by named path, in this repository's existing commit-message style. No AI attribution.
5. **Push and open the pull request.** Never as a draft. The description says what the handoff asked for, what was built, which gates ran, and — in a line each — any contradiction with `design/` and any judgement call that could reasonably have gone the other way.
6. **Watch it to merge** via `tools/Merge-PullRequest.ps1`, under the delegation `AGENTS.shared.md` § *Git and delivery* grants. Where the script refuses, bring the refusal back rather than merging around it.

## Judgement calls

`AGENTS.shared.md` § *The decision rule* is the authority — three tiers, and only the third stops. What it means here: the handoff is a mandate to make the first two. Make the call a careful colleague would, proceed, and put the ones that mattered in the report and the pull request — not as questions, as decisions already taken with their reasons. The user reverses one by saying so; that is cheaper for them than being asked.

**A call that is expensive to reverse and that the handoff does not reach is a blocker** — a licence, a public compatibility promise, a data migration, a schema everyone else will build against. Those are the user's, and they are asked as one question with a recommendation, after everything not depending on them is done.

## Scope

**Implement the handoff, and nothing adjacent to it** — `AGENTS.shared.md` § *Scope discipline*. Suspending the paperwork does not widen the work, and this is the one hard rule that survives the mode, because it protects the user rather than a design. Something nearby worth doing goes in the pull request after the requested work is finished.

## Report

One report at the end, in this repository's reporting shape, plus a `Decisions:` line:

```
Changed: <what>
Tests: <what ran, and its result — with what did not run>
Decisions: <the material-ambiguity calls that mattered, one clause each>
Remaining: <only where something is genuinely blocked or deliberately left>
```

`Decisions:` exists because a handoff makes those calls silently; without the line they are invisible. No retrospective design document unless the handoff asks for one.

## Never

- Propose a brief, a design pass, a contract amendment, a slice, a plan, or a tracker sync. Not as a next step, not as a suggestion, not as a caveat. Where the work genuinely warrants one, say so in one sentence in the pull request and let the user decide later. `AGENTS.shared.md` § *No covert reintroduction* lists the sentences this rule is most often broken with.
- Stop because the repository's process would ordinarily require a design or a contract. That is not a blocker, and saying it is one is the failure this command exists to remove.
- Write to `design/` — not a document, not a state record, not a decision entry. A handoff leaves no trace there by construction.
- File a GitHub issue or a milestone.
- Emit a work-start banner or a tier gate.
- Hand back a plan, a prompt, or a diff for the user to run or apply themselves.
- Open the pull request as a draft, or leave it green and unmerged.
- Claim a gate passed that did not run.
- Add AI attribution to anything.

## Re-run

Each invocation is independent. Given the same handoff again on a branch that already exists with an open pull request, that is `/pr`'s territory, not a fresh `/handoff` — say so and stop.
