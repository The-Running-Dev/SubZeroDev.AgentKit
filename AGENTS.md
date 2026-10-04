# Agent contract — this repository

This file holds the project rules for this repository, the kit's own. It is binding for every agent session in this repository, regardless of tool or model.

## Shared contract

**Read [`AGENTS.shared.md`](AGENTS.shared.md) completely before this file.** It holds the rules every repository using the kit shares, and they bind here as fully as anything written below. In this repository it is the checkout's own copy at the root, so a session reads the live edits rather than an installed copy. This file adds only what is specific to this repository; where the two conflict, the more specific instruction wins.

## Marked regions

This file's `videowright` block is written by the Videowright installer, not by the kit, so it is marked declared (`<!-- videowright:declared:start -->` … `:end -->`): the installer owns those bytes and rewrites them on re-install. A re-install putting the bare form back is that recurring, not a rule changing.

## House conventions

- **`videos/` is a [Videowright](https://github.com/scosman/videowright) subproject the kit does not own.** Its own conventions are the block at the end of this file, which the Videowright installer writes. `.github/workflows/verify.yml`'s `videos` job is the whole of what reaches the subtree, and what that job does not do is render. So a clean checkout is proven to install — which is where the `postinstall` patch risk lives — and is never proven to produce a video.

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
