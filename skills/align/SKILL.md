---
name: align
description: On request only — compare the design docs against the tree, then bring them back into agreement
disable-model-invocation: true
---

Runs only when the user asks. `design/` is a write-once spec (`AGENTS.shared.md` § *The design is the spec*); this command is how it is refreshed when the user wants it refreshed, not a step any other command waits on.

## Gather

- `design/10-design.md`, `design/20-contract.md`, `design/30-slices.md`, `design/90-decisions.md`.
- The code those documents describe.
- The **Differs from design** section of every merged pull request since `design/` last changed (`gh pr list --state merged --search "merged:>=<date>" --json number,title,body`). Those are mismatches already found and recorded while building; start from them rather than rediscovering them.

## Report

Before editing anything, list what disagrees, in these sections. A section with nothing in it says "none".

- **Contract** — places where the code and `20-contract.md` disagree about meaning: an invariant no longer held, an error raised under conditions the contract does not describe, a public signature that changed.
- **Design** — module boundaries crossed, control flow changed, a failure mode handled differently or not at all.
- **Undocumented decisions** — choices made while building that `90-decisions.md` does not record.
- **Invalidated assumptions** — anything the design assumed that building showed to be false.
- **Lessons** — things that cost time and would again, each naming what it cost. Propose them for `agent.md`; do not append them yourself.

Each item cites the `path:line` in the code and the section of the document. Plain wording differences are not drift.

## Then resolve

Ask the user to decide the divergences, one at a time, each with a recommendation: the document changes to match the code, or the code changes to match the document, and why that one. A passing test proves the code does what it does, not that it does what was agreed — do not assume the code is right because it runs.

A difference that is plainly a transcription — a renamed field, a moved file, a changed count — needs no question: correct the document and list it in the report.

Once decided, make the edits on a branch, append a `90-decisions.md` entry for each decision (date, decision, context, chosen, rejected and why), and ship it as one pull request per `AGENTS.shared.md` § *Git and delivery*. Never edit the acceptance criteria of a slice whose `Status:` is `done`.

## Re-run

Every run re-derives everything from the tree and `design/` as they stand now. A decision already recorded in `90-decisions.md` is not re-asked.
