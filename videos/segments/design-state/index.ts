import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../../components/scene-frame";

let host: HTMLElement | null = null;

interface Spoke {
	key: string;
	label: string;
	edgeLabel: string;
	x: number;
	y: number;
}

// Pentagon fan-out around a center at (864, 350) within the graph container, radius 280.
const SPOKES: Spoke[] = [
	{ key: "contract", label: "CONTRACT", edgeLabel: "consumes/exposes", x: 864, y: 70 },
	{ key: "invariant", label: "INVARIANT", edgeLabel: "binds", x: 1130, y: 264 },
	{ key: "decision", label: "DECISION", edgeLabel: "live decision", x: 1029, y: 576 },
	{ key: "question", label: "QUESTION", edgeLabel: "open question", x: 699, y: 576 },
	{ key: "workref", label: "WORKREF", edgeLabel: "GitHub work", x: 598, y: 264 },
];

const CENTER = { x: 864, y: 350 };

function outerNodeHTML(s: Spoke): string {
	return `
    <div data-ref="node-${s.key}" style="
      position: absolute; left: ${s.x}px; top: ${s.y}px; transform: translate(-50%, -50%) scale(0.6);
      width: 200px; height: 76px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      display: flex; align-items: center; justify-content: center;
      opacity: 0;
    ">
      <div style="position: absolute; left: -1px; top: -1px; width: 14px; height: 14px;">
        <div style="position: absolute; left: 0; top: 0; width: 14px; height: 1.5px; background: var(--cyan);"></div>
        <div style="position: absolute; left: 0; top: 0; width: 1.5px; height: 14px; background: var(--cyan);"></div>
      </div>
      <div style="position: absolute; right: -1px; bottom: -1px; width: 14px; height: 14px;">
        <div style="position: absolute; right: 0; bottom: 0; width: 14px; height: 1.5px; background: var(--cyan);"></div>
        <div style="position: absolute; right: 0; bottom: 0; width: 1.5px; height: 14px; background: var(--cyan);"></div>
      </div>
      <span style="font-family: var(--font-mono); font-size: 24px; letter-spacing: 0.1em; color: var(--color-fg);">${s.label}</span>
    </div>`;
}

function edgeLineHTML(s: Spoke, i: number): string {
	return `<line data-ref="edge-${s.key}" x1="${CENTER.x}" y1="${CENTER.y}" x2="${s.x}" y2="${s.y}" stroke="var(--cyan)" stroke-width="2" stroke-dasharray="1000" stroke-dashoffset="1000" />`;
}

function edgeLabelHTML(s: Spoke): string {
	const mx = (CENTER.x + s.x) / 2;
	const my = (CENTER.y + s.y) / 2;
	// Nudge label off the line so it doesn't sit on top of the stroke.
	const dx = s.x > CENTER.x ? 14 : s.x < CENTER.x ? -14 : 0;
	const dy = s.y < CENTER.y ? -18 : 18;
	return `
    <div data-ref="edgelabel-${s.key}" style="
      position: absolute; left: ${mx + dx}px; top: ${my + dy}px; transform: translate(-50%, -50%);
      font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.08em;
      color: var(--cyan); white-space: nowrap; opacity: 0;
      background: var(--color-bg); padding: 2px 6px;
    ">${s.edgeLabel}</div>`;
}

export default defineSegment({
	id: "design-state",
	advances: [65],
	voiceover:
		"Every design-state graph has exactly six entity kinds, hung off one central unit record. A unit consumes and exposes contracts, binds invariants, carries live decisions and open questions, and links out to GitHub work. That graph resolves to a real record on disk — four addressable lines. Compare that to a decision log: an append-only history of what was decided, on a date, versus a design-state record of what is true, right now, at one address. Current state is a fact with an address, not a conclusion drawn from prose.",
	notes:
		"Scene 07/15. Longest and most important segment — explains the six-entity design-state graph. Paced in four beats: graph reveal (~25s), record excerpt (~15s), split callout (~15s), closing quote (~10s, held).",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "07",
			total: "15",
			x: "864.00",
			y: "350.00",
			unitLabel: "ENTITY GRAPH · N=6",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; top: 24px; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 76px; line-height: 1.05; letter-spacing: -0.01em;
        opacity: 0;
      ">Six entities. One address each.</div>

      <div data-ref="graphPhase" style="position: absolute; left: 0; top: 190px; width: 100%; height: 700px; opacity: 1;">
        <svg data-ref="edges" style="position: absolute; inset: 0; overflow: visible;" width="1728" height="700">
          ${SPOKES.map(edgeLineHTML).join("\n")}
        </svg>
        ${SPOKES.map(edgeLabelHTML).join("\n")}
        ${SPOKES.map(outerNodeHTML).join("\n")}
        <div data-ref="node-unit" style="
          position: absolute; left: ${CENTER.x}px; top: ${CENTER.y}px; transform: translate(-50%, -50%) scale(0.6);
          width: 220px; height: 110px;
          border: 2px solid var(--color-accent);
          background: var(--color-surface);
          display: flex; align-items: center; justify-content: center;
          opacity: 0;
        ">
          <div style="position: absolute; left: -2px; top: -2px; width: 18px; height: 18px;">
            <div style="position: absolute; left: 0; top: 0; width: 18px; height: 2px; background: var(--color-accent);"></div>
            <div style="position: absolute; left: 0; top: 0; width: 2px; height: 18px; background: var(--color-accent);"></div>
          </div>
          <div style="position: absolute; right: -2px; top: -2px; width: 18px; height: 18px;">
            <div style="position: absolute; right: 0; top: 0; width: 18px; height: 2px; background: var(--color-accent);"></div>
            <div style="position: absolute; right: 0; top: 0; width: 2px; height: 18px; background: var(--color-accent);"></div>
          </div>
          <div style="position: absolute; left: -2px; bottom: -2px; width: 18px; height: 18px;">
            <div style="position: absolute; left: 0; bottom: 0; width: 18px; height: 2px; background: var(--color-accent);"></div>
            <div style="position: absolute; left: 0; bottom: 0; width: 2px; height: 18px; background: var(--color-accent);"></div>
          </div>
          <div style="position: absolute; right: -2px; bottom: -2px; width: 18px; height: 18px;">
            <div style="position: absolute; right: 0; bottom: 0; width: 18px; height: 2px; background: var(--color-accent);"></div>
            <div style="position: absolute; right: 0; bottom: 0; width: 2px; height: 18px; background: var(--color-accent);"></div>
          </div>
          <span style="font-family: var(--font-mono); font-size: 32px; letter-spacing: 0.12em; color: var(--color-accent); font-weight: 500;">UNIT</span>
        </div>
      </div>

      <div data-ref="recordPhase" style="position: absolute; left: 0; top: 190px; width: 100%; opacity: 0;">
        <div data-ref="recordCaption" style="
          font-family: var(--font-mono); font-size: 20px; letter-spacing: 0.15em; color: var(--color-muted);
          margin-bottom: 32px; opacity: 0;
        ">unit/command/track.md &middot; a real record</div>
        <div style="
          position: relative; background: var(--color-surface); border: 1px solid var(--color-border);
          padding: 48px 56px; width: 92%;
        ">
          <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--color-accent);"></div>
          <div data-ref="row-kind" style="font-family: var(--font-mono); font-size: 34px; line-height: 1.9; opacity: 0; transform: translateY(10px);"><span style="color: var(--color-muted);">Kind:</span> <span style="color: var(--color-fg);">command</span></div>
          <div data-ref="row-consumes" style="font-family: var(--font-mono); font-size: 34px; line-height: 1.9; opacity: 0; transform: translateY(10px);"><span style="color: var(--color-muted);">Consumes:</span> <span style="color: var(--cyan);">contract/test-designdrift, ...</span></div>
          <div data-ref="row-binds" style="font-family: var(--font-mono); font-size: 34px; line-height: 1.9; opacity: 0; transform: translateY(10px);"><span style="color: var(--color-muted);">Binds:</span> <span style="color: var(--cyan);">I28</span></div>
          <div data-ref="row-live" style="font-family: var(--font-mono); font-size: 34px; line-height: 1.9; opacity: 0; transform: translateY(10px);"><span style="color: var(--color-muted);">Live:</span> <span style="color: var(--color-accent);">decision/2026-08-03-work-defers-to-github...</span></div>
        </div>
      </div>

      <div data-ref="splitPhase" style="position: absolute; left: 0; top: 190px; width: 100%; height: 660px; opacity: 0;">
        <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--color-border); transform: translateX(-50%) scaleY(0); transform-origin: top;" data-ref="divider"></div>
        <div data-ref="colLeft" style="position: absolute; left: 0; top: 40px; width: 46%; opacity: 0; transform: translateY(14px);">
          <div style="font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.2em; color: var(--color-accent); margin-bottom: 28px;">DECISION LOG</div>
          <div style="font-family: var(--font-body); font-size: 32px; line-height: 1.5; color: var(--color-fg);">what was decided, on a date. Append-only. Never rewritten.</div>
        </div>
        <div data-ref="colRight" style="position: absolute; right: 0; top: 40px; width: 46%; opacity: 0; transform: translateY(14px);">
          <div style="font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.2em; color: var(--cyan); margin-bottom: 28px;">DESIGN-STATE RECORD</div>
          <div style="font-family: var(--font-body); font-size: 32px; line-height: 1.5; color: var(--color-fg);">what is true, now. One address.</div>
        </div>
      </div>

      <div data-ref="quotePhase" style="position: absolute; left: 0; top: 280px; width: 100%; opacity: 0;">
        <div style="
          position: relative; border: 2px solid var(--color-accent); padding: 56px 64px; width: 92%;
        ">
          <div style="position: absolute; left: -2px; top: -2px; width: 22px; height: 22px;">
            <div style="position: absolute; left: 0; top: 0; width: 22px; height: 2px; background: var(--color-accent);"></div>
            <div style="position: absolute; left: 0; top: 0; width: 2px; height: 22px; background: var(--color-accent);"></div>
          </div>
          <div style="position: absolute; right: -2px; bottom: -2px; width: 22px; height: 22px;">
            <div style="position: absolute; right: 0; bottom: 0; width: 22px; height: 2px; background: var(--color-accent);"></div>
            <div style="position: absolute; right: 0; bottom: 0; width: 2px; height: 22px; background: var(--color-accent);"></div>
          </div>
          <div style="font-family: var(--font-display); font-style: italic; font-size: 52px; line-height: 1.35; color: var(--color-fg);">
            &ldquo;Current state is a fact with an address, not a conclusion drawn from prose.&rdquo;
          </div>
        </div>
      </div>
    `;
	},

	async play(ctx) {
		animateSceneFrame(host!);
		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		const heading = host!.querySelector('[data-ref="heading"]') as HTMLElement;
		const graphPhase = host!.querySelector('[data-ref="graphPhase"]') as HTMLElement;
		const recordPhase = host!.querySelector('[data-ref="recordPhase"]') as HTMLElement;
		const splitPhase = host!.querySelector('[data-ref="splitPhase"]') as HTMLElement;
		const quotePhase = host!.querySelector('[data-ref="quotePhase"]') as HTMLElement;

		// ---- Beat 1: heading + graph (~25s) ----
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 600 },
		);
		await ctx.hold(700);

		const unitNode = host!.querySelector('[data-ref="node-unit"]') as HTMLElement;
		unitNode.animate(
			[
				{ opacity: 0, transform: "translate(-50%, -50%) scale(0.6)" },
				{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
			],
			{ ...opts, duration: 500 },
		);
		await ctx.hold(700);

		for (const s of SPOKES) {
			const edge = host!.querySelector(`[data-ref="edge-${s.key}"]`) as SVGLineElement;
			const node = host!.querySelector(`[data-ref="node-${s.key}"]`) as HTMLElement;
			const label = host!.querySelector(`[data-ref="edgelabel-${s.key}"]`) as HTMLElement;

			edge.animate([{ strokeDashoffset: 1000 }, { strokeDashoffset: 0 }], {
				...opts,
				duration: 600,
			});
			node.animate(
				[
					{ opacity: 0, transform: "translate(-50%, -50%) scale(0.6)" },
					{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
				],
				{ ...opts, duration: 450, delay: 300 },
			);
			label.animate([{ opacity: 0 }, { opacity: 1 }], {
				...opts,
				duration: 300,
				delay: 500,
			});
			await ctx.hold(750);
		}

		await ctx.hold(1200);
		await ctx.hold(18650); // hold the fully-drawn graph on screen

		// ---- Beat 2: record excerpt (~15s) ----
		graphPhase.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 400 });
		recordPhase.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 500,
			delay: 300,
		});
		const recordCaption = host!.querySelector('[data-ref="recordCaption"]') as HTMLElement;
		recordCaption.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 400,
			delay: 500,
		});
		await ctx.hold(600);

		const rows = ["row-kind", "row-consumes", "row-binds", "row-live"];
		for (const r of rows) {
			const row = host!.querySelector(`[data-ref="${r}"]`) as HTMLElement;
			row.animate(
				[
					{ opacity: 0, transform: "translateY(10px)" },
					{ opacity: 1, transform: "translateY(0)" },
				],
				{ ...opts, duration: 400 },
			);
			await ctx.hold(650);
		}
		await ctx.hold(1000);
		await ctx.hold(10800); // hold the record on screen

		// ---- Beat 3: split callout (~15s) ----
		recordPhase.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 400 });
		splitPhase.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 500,
			delay: 300,
		});
		const divider = host!.querySelector('[data-ref="divider"]') as HTMLElement;
		const colLeft = host!.querySelector('[data-ref="colLeft"]') as HTMLElement;
		const colRight = host!.querySelector('[data-ref="colRight"]') as HTMLElement;
		divider.animate(
			[
				{ transform: "translateX(-50%) scaleY(0)" },
				{ transform: "translateX(-50%) scaleY(1)" },
			],
			{ ...opts, duration: 500, delay: 300 },
		);
		colLeft.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450, delay: 500 },
		);
		colRight.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450, delay: 800 },
		);
		await ctx.hold(700);
		await ctx.hold(500);
		await ctx.hold(13800); // hold the callout on screen

		// ---- Beat 4: closing quote (~10s, held to end) ----
		splitPhase.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 400 });
		quotePhase.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 600, delay: 300 },
		);
		await ctx.hold(700);
		await ctx.hold(9300); // hold the closing quote for the remainder of the segment
	},

	unmount() {
		host = null;
	},
});
