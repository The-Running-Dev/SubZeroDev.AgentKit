import { defineSegment } from "videowright";
import {
	animateSceneFrame,
	SCENE_EASE,
	sceneFrameHTML,
} from "../../components/scene-frame";

let host: HTMLElement | null = null;

const NODES = [
	{ id: "node0", label: "DESIGN", x: 0, y: 0 },
	{ id: "node1", label: "IMPLEMENTATION", x: 1, y: 0 },
	{ id: "node2", label: "RECONCILE", x: 1, y: 1 },
	{ id: "node3", label: "TRACK", x: 0, y: 1 },
];

/** Runs one lap of sequential node pulses (does not await completion). */
function pulseLap(host: HTMLElement, stepMs: number): void {
	const opts = { fill: "forwards" as const, easing: SCENE_EASE };
	NODES.forEach((n, i) => {
		const node = host.querySelector(`[data-ref="${n.id}"]`) as HTMLElement;
		node.animate(
			[
				{
					boxShadow: "0 0 0 rgba(255,136,0,0)",
					borderColor: "var(--color-border)",
				},
				{
					boxShadow: "0 0 24px rgba(255,136,0,0.55)",
					borderColor: "var(--color-accent)",
				},
				{
					boxShadow: "0 0 0 rgba(255,136,0,0)",
					borderColor: "var(--color-border)",
				},
			],
			{ ...opts, duration: stepMs * 1.4, delay: i * stepMs },
		);
	});
}

export default defineSegment({
	id: "freeze-unfreeze",
	advances: [35],
	voiceover:
		"The loop has no fixed point while design keeps moving: design, implementation, reconcile, track, and back to design. Then a freeze bar slams down and breaks the cycle — recorded in design/FROZEN.md, with why it's frozen and what lifts it. Five commands refuse outright while frozen. Contradictions get recorded in the slice's PR, not chased into the design doc. When it lifts, reconcile and track each run once, then the loop resumes.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "12",
			total: "15",
			x: "0500.00",
			y: "0500.00",
			unitLabel: "UNIT: CYCLE STATE",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;

		const nodeHtml = NODES.map((n) => {
			const left = n.x === 0 ? 0 : 640;
			const top = n.y === 0 ? 0 : 320;
			return `
        <div data-ref="${n.id}" style="
          position: absolute; left: ${left}px; top: ${top}px; width: 400px; height: 180px;
          border: 2px solid var(--color-border);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-weight: 500; font-size: 34px;
          color: var(--color-fg);
          opacity: 0;
        ">${n.label}</div>`;
		}).join("");

		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 80px; top: 60px; right: 80px;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 68px;
        line-height: 1.1;
        letter-spacing: -0.01em;
        opacity: 0;
      ">The loop has no fixed point while design keeps moving.</div>

      <div data-ref="diagram" style="position: absolute; left: 260px; top: 300px; width: 1040px; height: 500px;">
        <svg style="position: absolute; inset: 0; overflow: visible; width: 100%; height: 100%;">
          <line data-ref="arrow0" x1="400" y1="90" x2="640" y2="90" stroke="var(--color-muted)" stroke-width="1.5" style="transform-origin: 400px 90px; transform: scaleX(0);" />
          <path d="M 640 90 L 620 80 M 640 90 L 620 100" stroke="var(--color-muted)" stroke-width="1.5" fill="none" />
          <line data-ref="arrow1" x1="840" y1="180" x2="840" y2="320" stroke="var(--color-muted)" stroke-width="1.5" style="transform-origin: 840px 180px; transform: scaleY(0);" />
          <path d="M 840 320 L 830 300 M 840 320 L 850 300" stroke="var(--color-muted)" stroke-width="1.5" fill="none" />
          <line data-ref="arrow2" x1="640" y1="410" x2="400" y2="410" stroke="var(--color-muted)" stroke-width="1.5" style="transform-origin: 640px 410px; transform: scaleX(0);" />
          <path d="M 400 410 L 420 400 M 400 410 L 420 420" stroke="var(--color-muted)" stroke-width="1.5" fill="none" />
          <line data-ref="arrow3" x1="200" y1="320" x2="200" y2="180" stroke="var(--color-muted)" stroke-width="1.5" style="transform-origin: 200px 320px; transform: scaleY(0);" />
          <path d="M 200 180 L 190 200 M 200 180 L 210 200" stroke="var(--color-muted)" stroke-width="1.5" fill="none" />
        </svg>
        ${nodeHtml}
      </div>

      <div data-ref="freezeBar" style="
        position: absolute; left: 80px; right: 80px; top: 480px; height: 140px;
        background: var(--color-accent);
        display: flex; align-items: center; justify-content: center;
        transform: scaleY(0); transform-origin: top center;
        opacity: 0;
        z-index: 5;
      ">
        <div style="font-family: var(--font-display); font-weight: 700; font-size: 96px; letter-spacing: 0.08em; color: var(--color-bg);">FREEZE</div>
      </div>

      <div data-ref="frozenDoc" style="
        position: absolute; left: 80px; top: 340px; width: 900px;
        background: var(--color-surface);
        border-left: 4px solid var(--color-accent);
        padding: 32px 40px;
        font-family: var(--font-mono);
        font-size: 26px;
        line-height: 1.7;
        color: var(--color-fg);
        opacity: 0;
      ">
        <div style="font-size: 16px; letter-spacing: 0.2em; color: var(--color-muted); margin-bottom: 20px;">design/FROZEN.md</div>
        <div><span style="color: var(--color-accent);">Frozen because:</span> the checkout contract changed mid-slice.</div>
        <div style="margin-top: 14px;"><span style="color: var(--color-accent);">Lifts when:</span> the new contract is ratified in design/.</div>
      </div>

      <div data-ref="callout" style="
        position: absolute; left: 80px; right: 80px; top: 760px;
        font-family: var(--font-body);
        font-size: 32px;
        line-height: 1.4;
        color: var(--color-fg);
        opacity: 0;
      ">Five commands refuse outright while frozen. Contradictions get recorded in the slice's PR &mdash; not chased into the design doc.</div>

      <div data-ref="unfreeze" style="
        position: absolute; left: 80px; right: 80px; top: 480px;
        text-align: center;
        font-family: var(--font-mono);
        font-size: 40px;
        letter-spacing: 0.1em;
        color: var(--cyan);
        opacity: 0;
      ">RECONCILE (once) &rarr; TRACK (once)</div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		const h = host;
		animateSceneFrame(h);

		const opts = { fill: "forwards" as const, easing: SCENE_EASE };
		const heading = h.querySelector('[data-ref="heading"]') as HTMLElement;
		const freezeBar = h.querySelector('[data-ref="freezeBar"]') as HTMLElement;
		const frozenDoc = h.querySelector('[data-ref="frozenDoc"]') as HTMLElement;
		const callout = h.querySelector('[data-ref="callout"]') as HTMLElement;
		const unfreeze = h.querySelector('[data-ref="unfreeze"]') as HTMLElement;

		const arrows = [0, 1, 2, 3].map(
			(i) => h.querySelector(`[data-ref="arrow${i}"]`) as SVGLineElement,
		);

		// Heading (~3s)
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 200 },
		);
		await ctx.hold(3000);

		// Cycle diagram draws + rotation (~8s)
		NODES.forEach((n, i) => {
			const node = h.querySelector(`[data-ref="${n.id}"]`) as HTMLElement;
			node.animate(
				[
					{ opacity: 0, transform: "translateY(12px)" },
					{ opacity: 1, transform: "translateY(0)" },
				],
				{ ...opts, duration: 360, delay: i * 120 },
			);
		});
		arrows.forEach((line, i) => {
			const axis = i % 2 === 0 ? "scaleX" : "scaleY";
			line.animate([{ transform: `${axis}(0)` }, { transform: `${axis}(1)` }], {
				...opts,
				duration: 300,
				delay: 480 + i * 120,
			});
		});
		await ctx.hold(1200);

		// Two pulse laps traveling around the loop
		pulseLap(h, 400);
		await ctx.hold(1600);
		pulseLap(h, 400);
		await ctx.hold(5200);

		// Freeze slams in (~2s)
		freezeBar.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: 60,
			fill: "forwards",
		});
		freezeBar.animate(
			[{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
			{ duration: 260, fill: "forwards", easing: "cubic-bezier(0.6, 0, 1, 1)" },
		);
		await ctx.hold(2000);

		// FROZEN.md excerpt (~6s)
		frozenDoc.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 420 },
		);
		await ctx.hold(6000);

		// Callout (~7s)
		callout.animate(
			[
				{ opacity: 0, transform: "translateY(12px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 420 },
		);
		await ctx.hold(7000);

		// Unfreeze sequence (~9s): freeze bar lifts away, reveal text, cycle resumes
		frozenDoc.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 300,
			fill: "forwards",
		});
		freezeBar.animate(
			[{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }],
			{ duration: 320, fill: "forwards", easing: SCENE_EASE, delay: 200 },
		);
		await ctx.hold(700);

		unfreeze.animate(
			[
				{ opacity: 0, transform: "translateY(-10px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 400 },
		);
		await ctx.hold(2500);

		unfreeze.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 400,
			fill: "forwards",
		});
		await ctx.hold(600);

		// Cycle resumes: one more pulse lap around the loop
		pulseLap(h, 350);
		await ctx.hold(2200);

		// Hold remainder briefly
		await ctx.hold(3000);
	},

	unmount() {
		host = null;
	},
});
