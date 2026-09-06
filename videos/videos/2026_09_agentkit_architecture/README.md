# AgentKit — Architecture Explainer

A ~9m35s Videowright video explaining AgentKit's architecture (the design-state graph, the pipeline, session boundaries, model routing, freeze/unfreeze, etc.) for a senior-engineer audience. No spoken narration — script content is on-screen typography per segment (see `PLAN.md` for why and the full script). Style: Motion Engineering.

## Regenerating

```bash
npm --prefix .. install          # from repo root, or `npm install` from videos/
npm run dev                      # preview at http://localhost:5173/video/2026_09_agentkit_architecture
npm run render -- videos/2026_09_agentkit_architecture/timeline.ts --output videos/2026_09_agentkit_architecture/exports/final.mp4
```

## Known upstream issues (videowright@0.1.1, Windows)

Three real bugs/mismatches in the installed `videowright@0.1.1` package were hit and fixed while building this video. If you bump the `videowright` version and things break again, check whether these are fixed upstream before re-patching:

1. **Missing `src/` shims for the dev-server entry.** The package's `files` allowlist ships `dist/` (compiled) and only `src/cli/entry` (raw dev-server TS), but `src/cli/entry/views/video_view.ts` imports sibling `../../../index.js` and `../../../timeline/resolveTiming.js`, expecting full TS source under `src/` that was never published. Fixed by adding tiny re-export shims at `node_modules/videowright/src/index.js` and `node_modules/videowright/src/timeline/resolveTiming.js` pointing at the compiled `dist/` build.

2. **Raw Windows filesystem paths passed to browser `import()`.** `vite_helpers.js`'s `globalsVirtualModulePlugin` and `projectVirtualModulePlugin` `JSON.stringify` raw Node paths (backslashes) straight into virtual modules that the *browser* (or Playwright's headless Chromium, for render) dynamically imports. A bare Windows path like `D:\foo\bar` triggers the WHATWG URL spec's "Windows drive letter" quirk when parsed by the browser, silently rewriting it to a `file://` URL — which a page served over `http://localhost` is not allowed to fetch ("Not allowed to load local resource"). Fixed by converting those two path fields to Vite's `/@fs/` URL convention before they reach the browser.

3. **Segment folder-layout mismatch.** The installer's own `setup_new_style.md` copies style-pack sample segments as *flat files* (`segments/<slug>-sample-<scene>.ts`), but the actual runtime (`discoverSegmentIds` in `vite_helpers.js`) only discovers `segments/<id>/index.ts` — a folder per segment. All 15 real segments in this video live at `segments/<id>/index.ts` accordingly; the flat sample files left over from style installation are unused reference material only, not a working example to copy from.

Fixes 1 and 2 patch `node_modules` directly, so they're **lost on every fresh `npm install`**. `scripts/patch-videowright.sh` re-applies them and runs automatically via the `postinstall` npm script — but if you ever bypass npm's lifecycle scripts (`--ignore-scripts`, a different package manager, etc.), run it by hand:

```bash
bash scripts/patch-videowright.sh
```

## Audio

No voiceover. Three CC0 SFX sourced from Openverse (`gate_confirm`, `freeze_latch`, `unfreeze_latch` — see `audio/audio_plan.md` for cue placement and attribution). No music.
