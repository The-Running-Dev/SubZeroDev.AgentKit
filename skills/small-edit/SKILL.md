---
name: small-edit
description: Make a small, contained edit — a rename, a copy change, a one-function fix — and verify it
argument-hint: "[the edit to make]"
disable-model-invocation: true
---

Make the edit described in **$ARGUMENTS**. Report the model profile as this command's adapter says: requested, resolved and verified active, separately.

## Stay small

A small edit touches a handful of lines in a few files, needs no design decision and no new test file. When it turns out bigger — the change spreads, a design question appears, or it needs real test work — stop before widening it, say what grew, and recommend `/implement`. Never switch profile or model yourself.

## Do it

1. Never edit on the default branch; branch off it first (`AGENTS.shared.md` § *Git and delivery*).
2. Make the edit, matching the surrounding code.
3. Run the narrowest check that proves it: the affected test, the typecheck, or the entry point it changes. Never say a check passed that did not run.
4. Commit by named path when the user wants it kept; open a pull request when it is meant to land.

## Report

Per `AGENTS.shared.md` § *Reporting*, with the model profile line: requested, resolved, verified active.
