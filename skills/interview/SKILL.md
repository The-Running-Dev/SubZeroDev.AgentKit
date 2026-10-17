---
name: interview
description: Clarify an idea into design/00-brief.md. Usage - /interview, or /interview a tool that renames my raw photo imports
argument-hint: "[one line about the idea, or nothing]"
disable-model-invocation: true
---

Turn **$ARGUMENTS** — together with whatever the user has already said in this conversation and whatever the repository already shows — into `design/00-brief.md`. You resolve what is still uncertain about what to build, and you type the file. The requirements are the user's.

## Stop first

- **`design/00-brief.md` already has real content** — this is a re-run. Read *Re-run* below before asking anything.
- **No `design/` at all** — that is the ordinary starting state. No install step comes first: when you write, `node tools/ensure-project-files.ts --repo-root . --design 00-brief.md --pointer --hook` puts the brief template in place, adds the shared-contract pointer to `AGENTS.md` (creating it, with a `CLAUDE.md` that imports it, where neither exists), and installs the commit-message hook. Each is left alone where it already exists; anything it reports `Occupied` or `Ambiguous` goes in the report, untouched.

## What this is for

The brief records what the user wants built: the problem or outcome, who it is for, and what done looks like. This interview clarifies that. It does not test whether the thing should be built.

**The user's stated reason is enough.** Automating something done by hand, preventing a mistake before it happens, saving time, or simply wanting the tool are each complete reasons. Never ask for — or hold the brief back for — a past incident or damage, how often something happens, a quantified cost, demand from other people, or proof that the current workaround falls short. Preventive work (backups, validation, safeguards) needs no incident first. Detail the user volunteers is recorded; its absence is not a gap.

Take answers at face value. Never treat a first answer as hiding a "real" one, and never assess whether the idea is a good one.

## Before asking anything

1. **Collect what is already supplied** — `$ARGUMENTS`, the conversation so far, an existing `design/00-brief.md`, any spec, issue or document the user pointed at. Each is an answer already given; do not ask for it again.
2. **Look before asking.** Where the repository can settle a question — existing configuration, scripts, templates, a standards file, conventions in use — read it instead. Asked to provision repositories with "my standard settings", read the settings and templates already in use before asking which ones are wanted.
3. **Keep only material unknowns.** An unknown is material when different answers would change behaviour, scope, constraints, interfaces, or how done is judged. Everything else is either a reversible assumption (below) or not needed.

## Asking

How much to ask depends on what arrived:

- **A formed request** — the outcome and enough constraints to build against — goes straight to the draft, with any small gaps written as assumptions. Asking nothing is a normal outcome.
- **A partly formed request** — ask only about the consequential gaps.
- **A vague idea** — explore. Ask the focused question that most narrows what to build: what should exist when this is done, what it acts on, who uses it. Never one that asks the user to defend wanting it.

For each question:

- Ask it only if its answer changes the work, and where it is not obvious, say what it changes.
- Offer a recommended answer where you have one, so a "yes" settles it.
- Ask one at a time where answers depend on each other; a short batch of independent ones is fine.

Stop asking once what remains is immaterial or cheap enough to assume and correct later. There are no fixed rounds and no required count of questions.

### Prompts by field

Reach for these only where a field is unknown and matters. Skip any already covered without announcing that you are skipping it — this is not a questionnaire to complete.

- **`## Problem`** — what the user wants to stop doing, fix, prevent, or be able to do. A desired outcome is a complete problem statement: *"new repositories should start with my standard settings"*.
- **`## What we do instead today (and what it costs)`** — optional. Record the current way where the user mentioned it or where it shapes the work — a manual checklist whose steps become the spec. Never press for a cost.
- **`## Who it is for`** — who uses it and how technical they are, where that affects the interface. *"Me"* is complete.
- **`## Narrowest useful version`** — the first thing worth having. Ask only where the request is large enough that the starting point is unclear; `/plan` reads it as the first slice's centre of gravity.
- **`## Environment`** — platform, scale, single- or multi-user, online or offline, the services or accounts it must work with. Often answerable from the repository.
- **`## Lifespan`** — throwaway, one season, or maintained. Ask only where it is unclear and would change how much of the pipeline is worth running (`README.md` § *When to skip most of this*). The user's answer stands.
- **`## Definition of done`** — checkable statements, each something that can be run, read, or counted. Criteria the user stated are requirements; criteria you derived from their request are assumptions until they say otherwise.
- **`## Non-goals`** — only what the user ruled out.

Gloss any term of this repository's own vocabulary — a slice, the contract — the first time you use it.

## Technical scrutiny

Clarifying is not the same as agreeing with everything. Raise, once and with the evidence:

- two requirements that cannot both hold;
- a technical claim — the user's or yours — that a cheap check contradicts, and run the check before raising it (`AGENTS.shared.md` § *Verification*);
- a constraint the named platform cannot meet, citing the documentation, the error text, or a probe;
- a material risk — data loss, an irreversible action, a security exposure.

State the concrete consequence, recommend a resolution, and settle that one point. It never reopens why the project exists.

## When the user says stop

*"Skip the interview"*, *"just write it"*, *"stop asking"*, *"draft the brief"*, or anything meaning the same, ends the interview **on the first request**. No defence of the process, no remaining questions, no second request needed. Write the brief from what is available, label what is unknown (below), and list the open items in the report, a line each.

If the user redirects to building it instead, do that within what they authorised — `AGENTS.shared.md` has direct instructions done directly, and the brief is not a toll gate in front of them.

## Stated, assumed, open

A model must not originate the user's requirements: handed a one-line idea, it returns something competent and not the user's problem. So keep three kinds of content apart in the brief:

- **Stated** — what the user said, or what a document they supplied says. Plain content in its field.
- **Assumed** — a reasonable, reversible reading you proceeded on: a default, an inferred environment, a derived done criterion. Written under `## Assumptions and open questions` as `Assumed: …`.
- **Open** — a consequential choice nobody has made yet. `Open: …` in the same section, with what it affects.

Never invent a motive, an experience, a history, a non-goal, or a binding criterion. A non-goal in `## Non-goals` binds every later session, so an inferred one goes in as `Assumed:` and stays there until the user confirms it. Where a field has nothing stated and nothing worth assuming, leave it empty and name it in the report — empty and labelled is honest; filled and plausible survives the whole pipeline as fiction.

Do not introduce a technology, library, or file format the user did not name — that is a decision made before there is anything to decide it against, and it is `/design`'s. One the user requires, or the repository already fixes, is a stated constraint and goes in `## Environment`.

## Writing

There is no premise round and no section-by-section sign-off. When the draft is ready, write it into the template `ensure-project-files.ts` put in place (*Stop first*), show what was written, and point at the `Assumed:` and `Open:` items. A correction from the user replaces the assumption it corrects.

## Never

- Never write anything but `design/00-brief.md` and what `ensure-project-files.ts` creates. Not `10-design.md`, not `90-decisions.md`. Architecture is `/design`'s, and proposing it here anchors the design to whatever came to mind during an interview.
- Never start a fresh round of questions after writing. `/brief` is the next stage's pass over the result, and running it here would make one session both the author and the judge.

## When done

Report in the `AGENTS.shared.md` § *Reporting* shape. `Result:` names any field left empty and each `Open:` item. `Next:` is the `Open:` item that blocks `/design`, if one does; otherwise `/brief`, which writes nothing and lists what the brief is missing, then `/design`.

## Re-run

**Stateful** — this is the only command that writes `design/00-brief.md`.

Where the file already has content, every filled field is an answer already given: read it, and ask only about fields that are empty or self-contradictory and that matter. Do not restart from the top, and do not rewrite a field the user wrote by hand — a hand-written `## Problem` outranks anything this interview would produce for it.

Before writing, show any filled field that would change, old and new, and get agreement; a re-run that silently replaces a brief has destroyed the one artifact nobody else can reconstruct. Under *When the user says stop*, fill only the empty fields and the assumptions section, and list proposed changes to filled fields in the report instead of making them.
