---
name: deep-debug
description: Root-cause a failure that resisted ordinary debugging, on the expensive profile, then hand back
argument-hint: "[the failure, what was already tried, and any issue number]"
disable-model-invocation: true
---

Find the root cause of the failure described in **$ARGUMENTS**. This is the expensive profile: it runs only because the user invoked it, and nothing here escalates further or delegates automatically. Report the model profile as this command's adapter says: requested, resolved and verified active, separately.

## Method

1. **Reproduce it.** Run what shows the failure and keep the exact output. Where it will not reproduce, stop and report what was tried; do not theorise past a missing reproduction.
2. **Read what was already tried** in the request, the issue and this session, so it is not repeated.
3. **Hypothesise, then test.** State one hypothesis at a time with the observation that would refute it, and run the probe. Record each result, confirmed or ruled out.
4. **Confirm the root cause against the original failure:** the explanation must predict it exactly, and removing the cause must make the original reproduction pass.

## Hand back

Deliver the root cause, its evidence and the smallest correct fix. Apply the fix here only when the user asked for it; then a regression test is verified by reverting the fix and watching it fail, and delivery follows `AGENTS.shared.md` § *Git and delivery*. Either way, recommend returning to the normal profile — `/fix` or `/implement` — for any further work.

## Report

Per `AGENTS.shared.md` § *Reporting*, with the model profile line and the hypotheses ruled out, one line each.
