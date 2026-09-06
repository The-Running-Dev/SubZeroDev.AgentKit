# Plan: AgentKit — Architecture Explainer

## Purpose
- Audience: Senior software engineers already familiar with AI coding agents (Claude Code/Codex), git/GitHub, CI/CD, and software architecture — no basic-concept explanation needed.
- Takeaway: Understand how AgentKit turns an AI coding agent from an improvisational assistant into a controlled software-engineering pipeline, well enough to reconstruct the mental model months later just by rewatching.
- Constraints / hard guidelines:
  - Source of truth is the repository itself (README, AGENTS.md, agent.md, INSTALL.md, .claude/COMPANIONS.md, design/*, .claude/commands/, tools/*.ps1) — not a generated summary. Flag doc/code contradictions rather than silently picking one.
  - Target 8–12 minutes; prefer dense 8 over padded 12.
  - Architecture/design explainer, not marketing. No "revolutionary/seamless/game-changing/AI-powered" language, no stock AI imagery, no robots/glowing brains.
  - Tone: technical, concise, slightly irreverent — one engineer explaining to another. Short sentences, dry humor welcome.
  - Visuals carry relationships (diagrams, pipeline flows, state transitions, highlighted repo excerpts, terminal-style command sequences) rather than narrating file paths repeatedly.
  - Central line the whole video returns to: "The artifact is the handoff, not the conversation."

## Style
- Active style: motion-engineering (blueprint/HUD aesthetic — charcoal canvas, cyan-white type, amber accent, dimension lines and crosshairs)
- Notes: leans hard into node/edge diagrams, pipeline flow, and state-transition visuals per the style's strengths. Repo text excerpts shown as highlighted single lines/sections, never walls of text.

## Audio intent
- Voiceover: no (revised — see log 2026-09-07). ElevenLabs is not free and the user declined it; no other TTS/VO provider is wired up in this project.
- Sound effects: yes, sourced via Openverse (free search, no API key)
- Background music: no
- Notes: No spoken narration. Videowright has no native subtitle/caption-track feature (confirmed by inspecting the skill's reference set), so the script text is instead baked into each segment's own on-screen typography — headline statements, leader-lined callouts, and lower-third readouts in the Motion Engineering style, rather than a separate caption overlay. Timing is driven entirely by each segment's own `advances` array (no audio track to sync against). SFX used sparingly at structural beats (stage transitions in the pipeline diagram, gate pass/fail states, freeze/unfreeze toggle) — functional, not decorative; no music bed.

## Segment outline
1. `title` — Cold open / title card: AgentKit, and the central question (how does it turn an agent from improv assistant into controlled pipeline?)
2. `problem` — The problem: agents reconstruct architecture, lose decisions across sessions, drift from contracts, burn expensive reasoning on deterministic work. Introduce "the artifact is the handoff, not the conversation."
3. `pipeline` — The main lifecycle diagram: Brief → Brief Check → Design → Red Team → Contract → Slices → Implement Slice → PR/Verify/Resolve → Merge → Track → Reconcile → Human Docs. Distinguish artifact-producing stages from review gates.
4. `session_boundaries` — Why certain transitions require a fresh session (and sometimes a different vendor): Design→Red Team, Slices→Slice, Slice→PR (same session), Merge→Track, Implementation→Reconcile. The committed artifact is the interface between agents.
5. `model_routing` — Reasoning cost follows complexity/reversibility, not file size. Deep reasoning vs. implementation tiers, and why the strongest model is deliberately not used for routine work.
6. `contracts` — Authority hierarchy: Brief → Contract → Design → Slices → Decision log. Non-goals, invariants, public interfaces, and acceptance criteria constrain implementation; an implementation agent can't quietly redesign the system.
7. `design_state` — The explicit design-state graph: Unit, Contract, Invariant, Decision, Question, WorkRef, and their relationships (consumes/exposes/binds/live decision/open question/GitHub work/implementation evidence). Decision log (historical) vs. design-state record (current truth).
8. `orientation` — One-hop orientation closure: a unit's record + directly referenced records + its actual artifact is enough — never reread the whole historical corpus. Fixed context budget regardless of project history.
9. `retirement_absorption` — Retirement (old state moved out of the active set, not deleted) and absorption (a decision's terms get written into the contract/artifact it concerns, so it no longer needs to live in active orientation state) — why this stops active context from growing forever.
10. `verification` — "Reasoning decides, code verifies what code can verify." Mechanical checks (unresolved refs, malformed records, missing artifacts, projection drift, orientation budget, marked-region well-formedness). Three-result philosophy: findings / reports / could-not-evaluate — a check that didn't run is never a pass.
11. `github_work_state` — GitHub owns work completion and acceptance criteria once an issue exists; the repo's mirror is explicitly non-authoritative. Avoids two competing databases of project state.
12. `freeze_unfreeze` — The design/implementation/reconcile/track loop has no fixed point while design keeps moving. Freeze locks the contract so slices implement against it and contradictions are recorded, not chased; unfreeze runs one reconcile + one track pass.
13. `install_reuse` — AgentKit is reusable infrastructure: installable into other repos via reconciliation (not overwrite). Core commands stay kit-owned; local companions carry repo-specific behavior; target repo customizations survive.
14. `example` — End-to-end walkthrough: "add retry support to an API client" traveling through brief → design → red team → contract → slices → implementation → tests → PR gates → resolve → merge → track → reconcile. Contrast with "just tell an agent to add retries" — the point isn't magic code quality, it's control over where decisions are made, what survives between sessions, and what's mechanically verifiable.
15. `close` — Recap the central principle and close.

## Script (if applicable)

No spoken voiceover. Below is the on-screen text script, organized by segment — each becomes typography/callouts baked directly into that segment. Durations are the segment's total `hold()` time (single-advance pattern: `advances: [duration]`, no `waitForNext`, since there is no external audio to sync to — this is a silent, self-paced render). Target total: ~9m35s.

### 1. `title` — 20s
- Crosshair tracks to center. Title: **AGENTKIT**. Subtitle (mono): `CONTROLLED SOFTWARE-ENGINEERING PIPELINE FOR AI CODING AGENTS`
- Dimension line brackets the title, label below: `HOW DOES AN AGENT GO FROM IMPROV TO CONTROLLED PIPELINE?`

### 2. `problem` — 35s
- Heading: "Agents don't lose the code. They lose the design."
- Callout quote (leader-lined): *"An expensive reasoning model reconstructs the project's current design state from prose every time it needs to work on the project."* — design/00-brief.md
- Stat block (real numbers from research): `22 COMMITS · 1 TOUCHED src/` / `14,600 LINES OF DESIGN CHURN vs 3,222 LINES OF SOURCE` — one slice landing on a sibling repo (SkyNetHR)
- Second stat: `1 OF 17 ISSUES` — a repo once marked "done" that wasn't
- Central line, boxed in amber: **"THE ARTIFACT IS THE HANDOFF, NOT THE CONVERSATION."**

### 3. `pipeline` — 55s
- Heading: "One pipeline, nine stages."
- Pipeline diagram draws left→right, node by node (dimension-line connectors): `BRIEF → BRIEF-CHECK → DESIGN → RED TEAM → CONTRACT → SLICES → SLICE → PR/VERIFY/RESOLVE → MERGE → TRACK → RECONCILE → HUMAN DOCS`
- Two node types called out via color/marker: amber square = "writes an artifact", cyan diamond = "review gate, writes nothing"
- Callout on Red Team node: "writes findings to `design/redteam/`, not the design doc"
- Closing line: "Three stages are hard stops, not pass-through: Design, Contract, Red Team." + quote: *"Sending work back a stage costs a few thousand tokens; finding it in stage six costs a re-implementation."*

### 4. `session_boundaries` — 45s
- Heading: "The committed artifact is the interface. The conversation is not."
- Boundary table draws in, row by row: `DESIGN → fresh session, different vendor → RED TEAM` / `SLICES → fresh session, one slice → SLICE` / `SLICE → same session → PR/VERIFY` / `MERGE → fresh session → TRACK` / `IMPLEMENTATION → fresh session → RECONCILE`
- Callout: "A model recognizes its own output distribution and defends it."
- Real incident callout (small, leader-lined): "Old shape: /clean always handed off to /track. /track opened a PR for its own mirror refresh. That merge put a new merge on the table. **3 bookkeeping PRs landed in one day.**" — fixed by `/next`'s rule: **"Act where the next step is legal. Stop where it is not."**

### 5. `model_routing` — 35s
- Heading: "Reasoning cost follows complexity and reversibility. Not file size."
- Two-tier readout: `DEEP REASONING — architecture, contracts, root-cause` / `IMPLEMENTATION — code against a settled contract, tests, CI`
- Stat callout: "Stage 6 (implement) on the top tier — the classic waste."
- Coordinate-style annotation: "A one-line change to an invariant is architectural. A 500-line transcription against a settled contract is not."

### 6. `contracts` — 35s
- Heading: "The contract is what the tree cannot say."
- Authority stack draws top to bottom: `BRIEF → CONTRACT → DESIGN → SLICES → DECISION LOG`
- Callout: "A `param` block declares the shape. The contract states only what code can't: which field means what, under which state, what must never default."
- Line: "An implementation agent is not authorized to quietly redesign the system because implementation became inconvenient."

### 7. `design_state` — 65s (longest segment — the core mechanism)
- Heading: "Six entities. One address each."
- Node-graph builds live: `UNIT` (center) with edges fanning out to `CONTRACT`, `INVARIANT`, `DECISION`, `QUESTION`, `WORKREF` — edges labeled as they draw: `consumes/exposes`, `binds`, `live decision`, `open question`, `GitHub work`
- Real record excerpt, highlighted single lines only (from `unit/command/track.md`): `Kind: command` / `Consumes: contract/test-designdrift, ...` / `Binds: I28` / `Live: decision/2026-08-03-work-defers-to-github...`
- Split-screen callout: **DECISION LOG** = "what was decided, on a date. Append-only. Never rewritten." vs. **DESIGN-STATE RECORD** = "what is true, now. One address."
- Quote, boxed: *"Current state is a fact with an address, not a conclusion drawn from prose."*

### 8. `orientation` — 35s
- Heading: "One hop. Not the whole corpus."
- Dimension-line diagram: a unit's record, its artifact, and the records it names directly — bracketed as "closure(U)" — everything else grayed out/excluded
- Big stat with dimension lines measuring it: **16,384 BYTES** — "the orientation budget. Fixed. Does not move with project history."
- Callout: "Once put 16 of the kit's own units over budget. An absorption pass brought every one back under. The ceiling never moved — what got measured did."

### 9. `retirement_absorption` — 35s
- Heading: "Two ways state leaves the active set."
- Split diagram: **RETIREMENT** — record moves to `retired/` companion file, arrow labeled "gone, but the id still resolves" / **ABSORPTION** — decision's terms move from `Live` into a `StatedIn` site the reader already reaches, arrow labeled "still true — just moved address"
- Quote, boxed: *"Nothing retires; a claim changes address."*

### 10. `verification` — 40s
- Heading: "Reasoning decides. Code verifies what code can verify."
- Three-column readout: `FINDINGS (21 blocking)` / `REPORTS (5, never blocking)` / `COULD NOT EVALUATE (6)`
- Callout: "A class is blocking only if it's checkable from the checkout alone. No network. No model judgement."
- Line, amber-boxed: **"Absence of a finding is not a finding of absence."** — exit code 2 (could-not-evaluate) always outranks exit code 1 (findings)

### 11. `github_work_state` — 30s
- Heading: "GitHub owns the work. The repo just mirrors it."
- Diagram: `GITHUB ISSUE (authoritative)` ⟶ `WorkRef (mirror, may be stale)` — mirror fields marked "may drift"; `Issue` field marked "source of truth"
- Callout: "No dashboard. No second database of what's done."

### 12. `freeze_unfreeze` — 35s
- Heading: "The loop has no fixed point while design keeps moving."
- Cyclic diagram animates: `DESIGN ↔ IMPLEMENTATION ↔ RECONCILE ↔ TRACK` spinning, then an amber `FREEZE` marker slams down, breaking the cycle
- `design/FROZEN.md` excerpt, highlighted: `Frozen because: ...` / `Lifts when: ...`
- Callout: "Five commands refuse outright while frozen. Contradictions get recorded in the slice's PR — not chased into the design doc."
- Unfreeze: marker lifts → `RECONCILE (once) → TRACK (once)` → cycle resumes

### 13. `install_reuse` — 35s
- Heading: "Installing is reconciliation. Not overwrite."
- Four-phase readout: `ORIENT → CLASSIFY → RECONCILE (propose, write nothing) → APPLY (feature branch + PR)`
- Split callout: **CORE** (`.claude/commands/*.md`) "kit-owned, cross-repo, never edited locally" vs. **COMPANION** (`*-local.md`) "repo-specific: vocabulary, doc paths, extra steps, tighter authorization only"
- Stat: "13 genuinely divergent command files in one repo alone — real specialization, not drift."

### 14. `example` — 55s
- Heading: "Add retry support to an API client."
- Path draws through the same pipeline diagram from segment 3, node by node, now lit up in sequence: `BRIEF → DESIGN (retry semantics) → RED TEAM (attacks assumptions) → CONTRACT (observable behavior) → SLICES → SLICE (one agent, one slice) → TESTS → PR GATES → RESOLVE → MERGE → TRACK → RECONCILE`
- Split-screen contrast, right side: "Tell an agent to add retries." — single arrow straight to "code," no gates, question mark.
- Closing line: "The point isn't that it writes better code by magic. It's control over where decisions get made, what survives between sessions, and what a machine can check."

### 15. `close` — 20s
- Recap, each line ticking in: "Artifacts, not conversation." / "Fresh sessions at real boundaries." / "Reasoning where it's expensive. Code where it's cheap."
- Final boxed line, held: **"THE ARTIFACT IS THE HANDOFF, NOT THE CONVERSATION."**
- Coordinate readout fades: `AGENTKIT · design/ + agent.md + .claude/commands/`

---

## Log

### 2026-09-07 — Initial scaffold
- PLAN.md drafted from user's brief (one-shot, audio intent confirmed: VO + SFX, no music). Style set to motion-engineering. Segment outline drafted mapping the brief's 13 narrative sections to 15 segments (split title/close from problem/example for pacing).

### 2026-09-07 — Voiceover dropped, on-screen text instead
- User declined ElevenLabs (not free); no other VO provider available. Revised audio intent to no voiceover. Script content will be authored directly as on-screen typography in each segment instead of a spoken track or a separate caption overlay (Videowright has no native subtitle/caption feature). SFX intent unchanged (Openverse). This also means timing comes from each segment's own `advances` array rather than an audio-synced `Timing`.

### 2026-09-07 — First full render + frame spot-check found and fixed one segment bug
- Ran the first full `videowright render` (1920x1080@60fps, 575s, 34,500 frames) to `exports/final.mp4`. Succeeded (exit 0), verified via ffprobe: exactly 575.000000s, h264 1920x1080@60fps + AAC audio.
- Spot-checked 15 extracted frames (one per segment, via `ffmpeg -ss <t> -frames:v 1`) rather than exhaustively reviewing all 34,500 — render mode is deterministic so a representative sample is sufficient to catch authoring bugs (dev mode's real-time playback isn't reliable for this, see previous log entry). 14 of 15 looked correct and matched the script/design intent closely.
- Found one real bug in `pipeline.ts`: the closing-lines transition faded out `heading`/`nodes`/`wrap`/`legend`/`leader`/`callout` but omitted the `connectors` (the SVG arrow lines between nodes) from the fade-out list, so faint connector lines remained visible behind the two closing text lines. One-line fix: added `...connectors` to the `wholeDiagram` fade-out array.
- Re-ran the full render after the fix (same command). Confirmed via ffprobe: 575.000000s exactly, h264 1920x1080@60fps + AAC audio. Re-extracted the previously-buggy frame — connector lines are gone, clean background behind the closing text. Spot-checked audio presence at a cue point (`volumedetect` around t=66s shows non-silent content, confirming the SFX mux worked). Final deliverable: `exports/final.mp4` (~14MB, 9m35s).

### 2026-09-07 — Dev-server verification: hit and fixed 3 upstream videowright@0.1.1 bugs
- Ran `npx videowright dev` to visually verify before rendering (per create_or_edit_video.md Step 7). Hit three real bugs in the installed package, all fixed — full writeup in `../../README.md`:
  1. `src/cli/entry/views/video_view.ts` imports sibling `src/index.js`/`src/timeline/resolveTiming.js` that the npm package's `files` allowlist never shipped (only `dist/` + `src/cli/entry`). Fixed with re-export shims in `node_modules/videowright/src/`.
  2. `vite_helpers.js` JSON-stringifies raw Windows filesystem paths (backslashes) directly into virtual modules the *browser* dynamically imports — triggers the WHATWG URL "Windows drive letter" quirk, silently becoming a `file://` URL the browser refuses to fetch ("Not allowed to load local resource"). Fixed by converting to Vite's `/@fs/` convention before those paths reach the browser (patches both `globalsVirtualModulePlugin` and `projectVirtualModulePlugin`).
  3. The installer's own `setup_new_style.md` copies sample segments as flat files, but the actual runtime (`discoverSegmentIds`) only discovers `segments/<id>/index.ts` (folder per segment) — a real mismatch between shipped skill docs and shipped runtime. Moved all 15 authored segments from flat files to `segments/<id>/index.ts`, fixed the now-one-level-deeper `../../components/scene-frame` import path in each.
- Wrote `scripts/patch-videowright.sh` (re-applies fixes 1 and 2, which patch `node_modules` directly and are lost on every fresh `npm install`) and wired it as a `postinstall` script in `package.json` so regeneration on a fresh clone doesn't silently break again.
- After fixes: dev server loads all 15 segments (verified via network tab, all `200 OK`), title/problem segments visually confirmed correct (crosshair, dimension lines, corner ticks, quote callout, stat blocks all render as designed).
- Proceeded to full `videowright render` (1920x1080@60fps, 575s = 34,500 frames) rather than exhaustively click through all 15 segments interactively in real-time dev mode — dev mode's per-segment `ctx.hold()` sequences run in real wall-clock time and drift during manual screenshot round-trips, making interactive spot-checking unreliable for exact-timing verification; the deterministic render is the actual source of truth and was spot-checked via extracted frames instead (see next log entry).

### 2026-09-07 — All 15 segments authored, SFX sourced, timeline assembled
- Created shared `components/scene-frame.ts` (grid/frame/corner-ticks/scene-counter/coordinate-readout chrome, reused by every segment) to avoid 15x duplicated boilerplate.
- Authored all 15 segments (`segments/title.ts` through `segments/close.ts`) via five parallel review passes, each self-checked against the render-safety checklist (fill-the-frame sizing, WAAPI + geometric easing, no bounce/spring/fade-only, `ctx.hold()` only — no `waitForNext` anywhere since there's no audio to sync to, single-value `advances` arrays matching each segment's total duration). Full project `tsc --noEmit` passes clean.
- Fixed one inconsistency caught by an authoring pass: `pipeline.ts`'s on-screen heading said "nine stages" but the diagram draws 12 nodes — corrected to "twelve stages."
- Sourced 3 SFX from Openverse (all CC0, no attribution required): `gate_confirm` (UI click, used twice — pipeline's RED TEAM reveal and example's PR GATES reveal), `freeze_latch`/`unfreeze_latch` (mechanical latch close/open, bracketing the FREEZE marker's entrance/exit in freeze-unfreeze). Proceeded without per-asset chat approval (per the user's "don't stop unless blocking" instruction) — noting the choice here rather than in a separate approval round-trip.
- Wrote `audio/audio_plan.md` (4 SFX cues, no VO/music) and `timeline.ts` (all 15 segments in order, fade transitions, motion-engineering tokens import, default_audio_track pointing at the rendered v1 track).

### 2026-09-07 — Repo research + on-screen script drafted
- Background research pass read README.md, agent.md, INSTALL.md, .claude/COMPANIONS.md, all design/*.md, design/state/, .claude/commands/*.md, and tools/*.ps1 in full. Grounded facts used throughout: the SkyNetHR drift numbers (22 commits, 1 touching src/, 14,600 lines of design churn vs 3,222 lines of source), the six design-state entity kinds (Unit/Contract/Invariant/Decision/Question/WorkRef) and real record excerpts, the 16,384-byte orientation closure budget and its history, the 21 blocking / 5 reported / 6 could-not-evaluate verification classes, the exact FROZEN.md format, and the companions override table. Full on-screen script written above, organized by segment, single-advance timing (no waitForNext — silent render, no audio to sync to). Total runtime target ~9m35s across 15 segments.
