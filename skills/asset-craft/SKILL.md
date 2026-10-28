---
name: asset-craft
description: Inspect references and prepare a generation-ready prompt and asset specification, then render it where an image tool is available
argument-hint: "[the asset wanted, and any reference files]"
disable-model-invocation: true
---

Produce the visual asset described in **$ARGUMENTS**. Report the model profile as this command's adapter says: requested, resolved and verified active, separately.

## Prepare

1. Inspect every reference given — images, a style guide, existing assets in the project — and any image-generation instructions the project keeps. Note palette, style, proportions and anything to match or avoid; an approved style, proportion or specification is preserved, not reinterpreted.
2. Write the asset specification: purpose, dimensions, format (PNG or JPG, never WebP), background and transparency, palette, style, and where the file goes in the project.
3. Write the generation-ready prompt from that specification, complete enough to hand to an image tool unchanged.

## Render — only with a tool

- **No image-generation tool is configured in this session: stop here.** Deliver the specification and the prompt, and say plainly that nothing was rendered and which capability is missing. A prompt is never reported as a generated asset.
- With a tool: when the user wants to approve a direction, render one sample first and wait for it. Otherwise render the asset, then look at the output against the specification before calling it done.
- Save each approved output in the project with a metadata sidecar next to it (`<file>.json`): the prompt, the image tool and its rendering model, the references, and the date. The chat model that wrote the prompt is not the model that rendered the image; name each for what it did.

## Report

Per `AGENTS.shared.md` § *Reporting*: what exists now — files rendered, or the specification and prompt only — with the model profile line.
