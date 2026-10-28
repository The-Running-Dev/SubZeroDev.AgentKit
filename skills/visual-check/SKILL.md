---
name: visual-check
description: Check rendered output against a reference image or a stated expectation, and report the differences
argument-hint: "[what to render, and the reference or expectation]"
disable-model-invocation: true
---

Check the rendered output named in **$ARGUMENTS** against its reference or stated expectation. Report the model profile as this command's adapter says: requested, resolved and verified active, separately.

## Render, then look

1. Use the real running app or browser: start it, open the page, capture the screen. Use whichever browser, preview or screenshot tool this host has.
2. **No way to run or capture it — stop.** Say which capability is missing. Never report runtime verification based only on reading code.
3. Compare against the reference, or against each stated expectation one at a time: appearance (layout, spacing, colour, typography, content), movement, interactions, and saved state where they apply, plus anything the request names. Check every size and theme the request names.

## Report

A verdict — matches, or differs — then each difference on one line: where it is, what was expected, what was observed. Keep what was observed apart from what was not tested, and name the untested parts. Keep the captures as files and link them. Fixing is separate: recommend `/small-edit` or `/implement` for the fixes unless the request asked for them to be made here. Close per `AGENTS.shared.md` § *Reporting*, with the model profile line.
