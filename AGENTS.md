# Agent contract — this repository

This file holds the project rules for this repository, the kit's own. It is binding for every agent session in this repository, regardless of tool or model.

## Shared contract

**Read [`AGENTS.shared.md`](AGENTS.shared.md) completely before this file.** It holds the rules every repository using the kit shares, and they bind here as fully as anything written below. In this repository it is the checkout's own copy at the root, so a session reads the live edits rather than an installed copy. This file adds only what is specific to this repository; where the two conflict, the more specific instruction wins (`AGENTS.shared.md`, *Safe start*).

## Marked regions

A region a tool outside the kit writes is declared (`AGENTS.shared.md`, *Marked regions*). This file's own `videowright` block is the instance: the Videowright installer owns those bytes and rewrites them on re-install, so the form is this repository's to assert and the installer's to overwrite. A re-install putting the bare form back is this finding recurring, not the rule changing.

## House conventions

- **`videos/` is a [Videowright](https://github.com/scosman/videowright) subproject and sits outside the design-state corpus.** It is not reached by any glob in `design/20-contract.md` § *Artifacts of a unit kind*, holds no unit record, and contributes nothing to a closure — deliberately, because the design's subject is the design-state mechanism and a Node toolchain of a few hundred files would put `GlobDisagreement` in permanent conflict with a directory the kit does not own. Its own conventions are the block at the end of this file, which the Videowright installer writes; do not widen a glob to reach it. **Sitting outside the corpus does not mean sitting outside CI**, and the two were decided separately: `.github/workflows/verify.yml`'s `videos` job is the whole of what reaches the subtree, and what that job does not do is render. So a clean checkout is proven to install — which is where the `postinstall` patch risk lives — and is never proven to produce a video.

<!-- videowright:declared:start -->
*Auto-managed by Videowright installer. Edits inside this block will be overwritten on re-install. Add your own context outside the markers.*

The folder `videos/` in this project is a [Videowright](https://github.com/scosman/videowright) project -- a library for composing animated explainer videos in HTML/CSS/JS.

For any video-related work, use the `videowright` skill (loaded automatically from `.claude/skills/videowright` or `.agents/skills/videowright`). It has full guidance on segments, voiceovers, styles, and the dev server.

Key paths:
- `videos/videowright.config.ts` -- project config and default style.
- `videos/videos/` -- one folder per video.
- `videos/styles/` -- design tokens and shared styling.
- `videos/segments/`, `videos/components/`, `videos/transitions/` -- shared building blocks.
<!-- videowright:declared:end -->
