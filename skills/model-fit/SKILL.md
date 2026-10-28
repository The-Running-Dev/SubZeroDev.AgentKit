---
name: model-fit
description: Recommend the task profile, model and effort for a piece of work without doing it
argument-hint: "[a description of the task]"
disable-model-invocation: true
---

Recommend how to run the task in **$ARGUMENTS**. Do not start the task, edit files or run anything that writes.

## Read the profiles

Run `node tools/model-profile.ts --list`. It prints every task profile with its purpose, the model and effort for each provider, any override in `config.json`, and which profile is expensive. Recommend only from that output, never from memory.

## Pick one

- **Slice work and bugs are not task profiles.** The next slice in `design/30-slices.md` is `/next`; a defect is `/fix`. Say so and stop.
- Otherwise pick the one profile whose purpose fits: `/small-edit` for a contained change, `/implement` for a scoped change with tests, `/visual-check` to compare rendered output against a reference, `/asset-craft` for visual assets, `/deep-debug` for a failure ordinary debugging has not cracked.
- Prefer the cheaper profile when two fit. Recommend `/deep-debug` only with evidence that ordinary debugging already failed — it is the expensive profile.
- Never recommend `ultra` effort; it adds automatic task delegation none of these profiles needs.

## Report

One recommendation: the command, its model and effort for the host this session runs on (and the other provider's, on one line), and one line on why it fits — from the task's scope, its ambiguity, the tools it needs and how it must be verified. Never estimate savings. Say plainly that this is a recommendation — nothing was switched, and a profile applies only when its command is invoked. Name what applies it on this host: the `-routed` command under Codex, or the command itself under Claude Code, where the host may still decline the model.
