---
name: interview
description: Conduct the interview that produces design/00-brief.md. Usage - /interview, or /interview a tool that renames my raw photo imports
argument-hint: "[one line about the idea, or nothing]"
disable-model-invocation: true
---

<!-- companion:declared:start -->
**Per-repo companion:** `skills/interview/SKILL-local.md`. Read it now, if it exists — an absent,
empty, or frontmatter-only file is no companion, and this file then stands alone.
It may override: `vocabulary`, `document-map`. It may never override anything in
[`.claude/COMPANIONS.md`](../../.claude/COMPANIONS.md) § *Never*, which is also where these categories are defined.
<!-- companion:declared:end -->

Ask the questions that turn **$ARGUMENTS** — or an idea that so far exists only in the user's head — into `design/00-brief.md`. You conduct the interview and you type the file. You do not supply what goes in it.

## Stop first

- **`design/FROZEN.md` exists** — refuse. Report its `Frozen because` and `Lifts when` lines **verbatim** and stop. Authoring is gated while the design is frozen (`AGENTS.shared.md`, *The design freeze*), and the brief is the furthest upstream thing there is to author.
- **`design/00-brief.md` already has real content** — this is a re-run. Read *Re-run* below before asking anything.
- **No `design/` at all** — that is the ordinary starting state. Copy `templates/design/00-brief.md` into place when you write, and leave the rest of the seed to `/install`.

## What this command is not

The brief is the one artifact a model must not originate. Models elaborate well and originate badly — handed a one-line idea, a model returns something competent, unsurprising, and not the user's problem. That is why stage 0 had no command for as long as it did.

What transfers is the **interrogation**, not the authorship. The questions a good advisor asks before letting anyone build are known ones, and asking them costs almost nothing; what the pipeline was missing was somebody to ask them, in order, without letting a vague answer through. The user supplies every answer. You supply the pressure and the typing.

Concretely: **never invent the problem, a non-goal, or a definition-of-done criterion.** Where an answer is missing, ask again, or leave the field empty and say which field you left empty. An empty `## Non-goals` is an honest brief for `/brief` to attack; an invented one is a constraint binding every later session that nobody chose.

## Posture

Be direct to the point of discomfort. Comfort means the question did not land. Take a position on every answer and say what evidence would change it — that is rigour, not hedging, and it is the opposite of both flattery and false certainty.

**Do not say, at any point in the interview:**

- *"That's an interesting approach"* — take a position instead.
- *"There are many ways to think about this"* — pick one and name the evidence that would move you off it.
- *"You might want to consider…"* — say *this will not work, because* or *this works, because*.
- *"That could work"* — say whether it will, on the evidence in hand, and name the evidence that is missing.
- *"I can see why you'd think that"* — if the answer is wrong, say it is wrong and why.

**Do:**

- Push once, then push again. The first answer to any of these questions is the polished version; the real one arrives on the second or third push.
- Challenge the strongest reading of what the user said, never a weaker one you can dispose of.
- Acknowledge a good answer by naming what was good about it and asking a harder question. Do not linger on it.
- Name a failure pattern when you see it — *a solution looking for a problem*, *hypothetical users*, *the workaround is fine and nobody will switch*, *this is three projects*.
- Gloss any term of this repository's own vocabulary the first time you use it (`AGENTS.shared.md`, *Output discipline*). Someone writing their first brief does not yet know what a slice or a closure is, and an interview is the worst possible place to start using them unexplained.

A claimed impossibility is a claim like any other and needs evidence before it is allowed to shape the brief — the user's as much as yours (`AGENTS.shared.md`, *Verification*). Where a cheap check settles it, run the check before asking anything further.

## The five questions

Ask them **one at a time**. Stop after each and wait. Push on the answer until it is specific enough to write down, then move on. Do not batch them, do not preview the list, and do not proceed to the next one because the answer was nearly good enough.

Each question names the brief field it fills, because that is the whole reason it is being asked.

### 1 — What breaks today → `## Problem`

*"What goes wrong right now? Not the thing you want to build — the thing that is already going wrong without it."*

**Push until you have** a specific failure that has actually happened: a task that took an afternoon, a file lost, a number that came out wrong, a step done by hand every week. A date or a count is worth more than an adjective.

**Red flags:** an answer phrased as the absence of the solution (*"there's no good tool for this"*), a category rather than an event (*"managing photos is a mess"*), or a problem that turns out to be someone else's.

### 2 — What you do instead today, and what it costs → `## What we do instead today (and what it costs)`

*"What are you doing about it right now, even badly? And what does that cost you — in hours, in errors, in money?"*

**Push until you have** the actual workaround: the spreadsheet, the folder of scripts, the manual step, the thing done twice because the first way is unreliable. Then its cost, as a number where one exists.

**Red flags:** *"nothing"*. If there is genuinely no workaround and nobody has bothered improvising one, the problem may not be worth the pipeline — say so plainly and ask whether that is right, rather than writing it down and moving on. The status quo is the real competitor for anything built here, and a workaround that is already good enough is the most common reason a finished tool goes unused.

### 3 — Who exactly → `## Who it is for`

*"Who has this problem? Name them. If it is you, say so, and say how often you hit it."*

**Push until you have** a person or a specific role, a count, and their skill level. *"Me, most weekends"* is a complete answer. *"Me, plus two colleagues who will not touch a command line"* is a better one, because it has just constrained the design.

**Red flags:** a category — *"developers"*, *"small teams"*, *"anyone with a camera"*. A category cannot be asked afterwards whether the thing worked.

### 4 — The narrowest useful version → `## Narrowest useful version`

*"What is the smallest version of this that would be worth having by the end of the week? Not the demo — the version you would actually use."*

**Push until you have** one thing: a single operation, a single report, one kind of file transformed. The user should be able to describe something that could exist in days.

**Red flags:** *"the whole thing has to exist before any of it is useful"*. Occasionally true, and usually a sign the value is not located yet; say which you think it is. This answer does not narrow the brief — the brief still describes the whole thing — it records where to start, and `/plan` reads it as the first slice's centre of gravity.

### 5 — Does it still matter in a year → `## Lifespan`

*"Is this throwaway, one season, or something you will still be maintaining in two years?"*

**Push until you have** one of those three and a reason. Not a preference — a reason: something that changes, or does not, in the world the tool sits in.

**Red flags:** *"maintained for years"* given by default. It is the expensive answer and it is the one everybody picks. Ask what will still be true in two years that makes it worth the whole pipeline; if nothing comes back, the honest answer is one season, and `README.md` § *Skipping most of it* is what that answer buys.

**Skip a question an earlier answer already covered.** Say which you are skipping and why. Do not ask for something already on the table just to complete the set.

## Escape hatch

If the user pushes back — *"just write it"*, *"skip the questions"*:

- Say once that the questions are the value here, and that skipping them writes a brief every later stage then inherits. Then ask the **two** whose answers are still genuinely missing, and move on.
- **If the user pushes back a second time, stop asking.** Draft the brief from what you have, mark every field you could not fill as empty, and say which they are. Do not ask a third time.
- A full skip is legitimate only where the user has already supplied a formed answer to all five. Even then, the premises step below still runs.

## Premises, then the brief

Before writing anything, state what you now believe — including what the user did not say outright but the answers imply. Numbered, one line each, for agreement or disagreement:

```
PREMISES:
1. <statement> — agree/disagree?
2. <statement> — agree/disagree?
```

This is where an assumption gets caught while catching it is still free. Four to six premises; if there are ten, the interview did not converge, and saying so is more useful than listing them.

Then draft the three fields the questions did not ask for directly, and put them up **one at a time for sign-off** (`AGENTS.shared.md`, *Working with me*):

- **`## Non-goals`** — the adjacent things this must not become. Draft them from what the user ruled out while answering, say which answer each came from, and change any the user corrects. **Every non-goal binds every later session permanently**, so say that out loud when presenting the list. A non-goal the user did not agree to is the worst single output this command can produce.
- **`## Definition of done`** — checkable statements, not aspirations. Each one has to be something that can be run, read, or counted.
- **`## Environment`** — scale, data volume, platform, single-user or not, online or offline. Usually the cheapest section, and the one whose absence a design silently invents an answer for.

Only then write `design/00-brief.md`, from `templates/design/00-brief.md`, and show what was written.

## Never

- Never write anything but `design/00-brief.md`. Not `10-design.md`, not `90-decisions.md`, not the tracker. Architecture is `/design`'s, and proposing it here anchors the design to whatever happened to come to mind during an interview.
- Never name a technology, a library, or a file format. The brief describes the problem; a tool named at this stage is a decision made before there was anything to decide it against.
- Never fill a field the user did not answer. Empty and labelled is a finding; filled and plausible is a fiction that survives the whole pipeline.
- Never ask a second round of questions after writing. `/brief` is the next stage and its four lists are the second pass — that is the boundary, and running it here would make one session both the author and the judge.
- Never assess whether the idea is a good one. This interview establishes what the idea *is*.

## Hand off

The brief is committed and the session ends. `/brief` runs next, in a fresh session, and it deliberately writes nothing — the user edits the brief from its four lists (`AGENTS.shared.md`, *Session boundaries*).

Emit the transfer block `AGENTS.shared.md` § *The session-transfer handoff block* requires, then that boundary's banner. `Start here` is `/brief`; `Authoritative inputs` is `design/00-brief.md` at the commit just written. **`Current state` names the fields left empty and says they are empty** — an unanswered field is this command's finding, and it is the one thing the next session must not mistake for an oversight. Nothing else from the interview crosses: not the answers behind a field, not what the user nearly said, not this session's reading of what they meant.

## Re-run

**Stateful, and destructive if run carelessly** — it is the only command that writes `design/00-brief.md`.

Where the file already has content, treat every filled field as an answer already given: read it, say which fields are filled, and ask only about the ones that are empty or self-contradictory. Do not re-ask the five questions from the top, and do not rewrite a field the user wrote by hand — a hand-written `## Problem` outranks anything this interview would produce for it.

Before writing, show the fields that would change, old and new, and get agreement. A re-run that silently replaces a brief has destroyed the one artifact in the pipeline nobody else can reconstruct.
