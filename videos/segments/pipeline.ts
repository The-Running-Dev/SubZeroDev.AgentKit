import { defineSegment } from "videowright";
import {
	animateSceneFrame,
	SCENE_EASE,
	sceneFrameHTML,
} from "../components/scene-frame";

interface StageNode {
	label: string;
	kind: "artifact" | "gate";
}

const STAGES: StageNode[] = [
	{ label: "BRIEF", kind: "artifact" },
	{ label: "BRIEF-CHECK", kind: "gate" },
	{ label: "DESIGN", kind: "artifact" },
	{ label: "RED TEAM", kind: "gate" },
	{ label: "CONTRACT", kind: "artifact" },
	{ label: "SLICES", kind: "artifact" },
	{ label: "SLICE", kind: "artifact" },
	{ label: "PR/VERIFY/RESOLVE", kind: "artifact" },
	{ label: "MERGE", kind: "artifact" },
	{ label: "TRACK", kind: "artifact" },
	{ label: "RECONCILE", kind: "artifact" },
	{ label: "HUMAN DOCS", kind: "artifact" },
];

let host: HTMLElement | null = null;

function nodeHTML(stage: StageNode, index: number): string {
	const marker =
		stage.kind === "artifact"
			? `<span style="display:inline-block;width:10px;height:10px;background:var(--color-accent);margin-right:8px;flex-shrink:0;"></span>`
			: `<span style="display:inline-block;width:10px;height:10px;background:var(--cyan);transform:rotate(45deg);margin-right:8px;flex-shrink:0;"></span>`;
	return `
    <div data-ref="node" data-index="${index}" style="
      position: relative;
      flex: 1 1 0;
      min-width: 0;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 14px 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
    ">
      ${marker}
      <span style="
        font-family: var(--font-mono);
        font-size: 14px;
        letter-spacing: 0.04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--color-fg);
      ">${stage.label}</span>
    </div>`;
}

function connectorHTML(index: number): string {
	return `
    <svg data-ref="connector" data-index="${index}" style="width: 28px; height: 12px; flex-shrink: 0; overflow: visible;" viewBox="0 0 28 12">
      <line x1="0" y1="6" x2="20" y2="6" stroke="var(--color-muted)" stroke-width="1.5" style="transform-origin: 0px 6px; transform: scaleX(0);" />
      <polygon points="20,1 28,6 20,11" fill="var(--color-muted)" style="opacity: 0;" />
    </svg>`;
}

export default defineSegment({
	id: "pipeline",
	advances: [55],
	voiceover:
		"One pipeline, nine stages. Brief, brief-check, design, red team, contract, slices, slice, PR/verify/resolve, merge, track, reconcile, human docs. Squares write an artifact. Diamonds are review gates that write nothing. Red team writes findings to design/redteam, not the design doc. Three stages are hard stops, not pass-through: design, contract, red team. Sending work back a stage costs a few thousand tokens; finding it in stage six costs a re-implementation.",
	notes:
		"12-stage pipeline diagram, two rows of six, drawn in node-by-node/connector-by-connector over ~16s. Holds fully visible, a leader-lined callout points at RED TEAM, then the diagram fades for two closing lines that hold to the end of the segment.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "03",
			total: "15",
			x: "512.00",
			y: "288.00",
			unitLabel: "UNIT: STAGE · N=12",
		});

		const content = host.querySelector('[data-ref="content"]') as HTMLElement;
		content.style.opacity = "1";

		const row1 = STAGES.slice(0, 6);
		const row2 = STAGES.slice(6, 12);

		const rowHTML = (stages: StageNode[], offset: number) =>
			stages
				.map((s, i) => {
					const idx = offset + i;
					const node = nodeHTML(s, idx);
					const connector = i < stages.length - 1 ? connectorHTML(idx) : "";
					return node + connector;
				})
				.join("");

		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; right: 0; top: 40px;
        text-align: center;
        font-family: var(--font-mono);
        font-size: 22px;
        letter-spacing: 0.15em;
        color: var(--color-muted);
        opacity: 0;
      ">ONE PIPELINE, TWELVE STAGES.</div>

      <div data-ref="row1" style="
        position: absolute; left: 5%; right: 5%; top: 160px;
        display: flex; align-items: stretch;
      ">${rowHTML(row1, 0)}</div>

      <svg data-ref="wrap" style="position: absolute; left: 50%; top: 232px; width: 4px; height: 96px; transform: translateX(-50%); overflow: visible;">
        <line x1="2" y1="0" x2="2" y2="80" stroke="var(--color-muted)" stroke-width="1.5" style="transform-origin: 2px 0px; transform: scaleY(0);" />
        <polygon points="-3,80 7,80 2,90" fill="var(--color-muted)" style="opacity: 0;" />
      </svg>
      <div data-ref="wrap-label" style="
        position: absolute; left: 50%; top: 340px; transform: translateX(-50%);
        font-family: var(--font-mono);
        font-size: 13px;
        letter-spacing: 0.2em;
        color: var(--color-muted);
        opacity: 0;
      ">CONTINUES BELOW</div>

      <div data-ref="row2" style="
        position: absolute; left: 5%; right: 5%; top: 372px;
        display: flex; align-items: stretch;
      ">${rowHTML(row2, 6)}</div>

      <div data-ref="legend" style="
        position: absolute; left: 5%; top: 452px;
        display: flex; gap: 48px;
        font-family: var(--font-mono);
        font-size: 15px;
        letter-spacing: 0.06em;
        color: var(--color-muted);
        opacity: 0;
      ">
        <span><span style="display:inline-block;width:9px;height:9px;background:var(--color-accent);margin-right:8px;"></span>WRITES AN ARTIFACT</span>
        <span><span style="display:inline-block;width:9px;height:9px;background:var(--cyan);transform:rotate(45deg);margin-right:8px;"></span>REVIEW GATE, WRITES NOTHING</span>
      </div>

      <svg data-ref="leader" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; opacity: 0;">
        <line x1="0" y1="0" x2="0" y2="0" stroke="var(--color-muted)" stroke-width="1.5" />
        <circle cx="0" cy="0" r="4" fill="var(--color-accent)" />
      </svg>
      <div data-ref="callout" style="
        position: absolute; width: 420px;
        font-family: var(--font-mono);
        font-size: 17px;
        line-height: 1.5;
        color: var(--color-fg);
        opacity: 0;
      ">writes findings to <span style="color: var(--color-accent);">design/redteam/</span>, not the design doc</div>

      <div data-ref="closing" style="
        position: absolute; left: 6%; right: 6%; top: 320px;
        text-align: center;
        opacity: 0;
      ">
        <div style="
          font-family: var(--font-display);
          font-weight: 500;
          font-size: 52px;
          line-height: 1.3;
        ">Three stages are hard stops, not pass-through:<br />Design, Contract, Red Team.</div>
        <div style="
          margin-top: 56px;
          font-family: var(--font-body);
          font-size: 28px;
          line-height: 1.5;
          color: var(--color-muted);
        ">&ldquo;Sending work back a stage costs a few thousand tokens;<br />finding it in stage six costs a re-implementation.&rdquo;</div>
      </div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		animateSceneFrame(host);
		const content = host.querySelector('[data-ref="content"]') as HTMLElement;
		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		const heading = content.querySelector(
			'[data-ref="heading"]',
		) as HTMLElement;
		const nodes = Array.from(
			content.querySelectorAll('[data-ref="node"]'),
		) as HTMLElement[];
		const connectors = Array.from(
			content.querySelectorAll('[data-ref="connector"]'),
		) as SVGElement[];
		const wrap = content.querySelector('[data-ref="wrap"]') as SVGElement;
		const wrapLine = wrap.querySelector("line") as SVGLineElement;
		const wrapArrow = wrap.querySelector("polygon") as SVGPolygonElement;
		const wrapLabel = content.querySelector(
			'[data-ref="wrap-label"]',
		) as HTMLElement;
		const legend = content.querySelector('[data-ref="legend"]') as HTMLElement;
		const leader = content.querySelector('[data-ref="leader"]') as SVGElement;
		const leaderLine = leader.querySelector("line") as SVGLineElement;
		const leaderDot = leader.querySelector("circle") as SVGCircleElement;
		const callout = content.querySelector(
			'[data-ref="callout"]',
		) as HTMLElement;
		const closing = content.querySelector(
			'[data-ref="closing"]',
		) as HTMLElement;
		const wholeDiagram: Element[] = [
			heading,
			...nodes,
			wrap,
			wrapLabel,
			legend,
			leader,
			callout,
		];

		// 0. Heading
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(-8px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500 },
		);
		await ctx.hold(1500);

		// 1. Draw the diagram node-by-node, connector-by-connector, over ~16s.
		const drawSpanMs = 16000;
		const nodeStep = drawSpanMs / nodes.length; // ~1333ms
		nodes.forEach((node, i) => {
			node.animate(
				[
					{ opacity: 0, transform: "translateY(12px) scale(0.96)" },
					{ opacity: 1, transform: "translateY(0) scale(1)" },
				],
				{ ...opts, duration: 420, delay: i * nodeStep },
			);
		});
		connectors.forEach((conn, i) => {
			const line = conn.querySelector("line") as SVGLineElement;
			const arrow = conn.querySelector("polygon") as SVGPolygonElement;
			const delay = i * nodeStep + nodeStep * 0.55;
			line.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
				...opts,
				duration: 260,
				delay,
			});
			arrow.animate([{ opacity: 0 }, { opacity: 1 }], {
				...opts,
				duration: 150,
				delay: delay + 220,
			});
		});
		// Row-wrap connector fires between row 1 (index 5) and row 2 (index 6).
		const wrapDelay = 5 * nodeStep + nodeStep * 0.8;
		wrapLine.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
			...opts,
			duration: 300,
			delay: wrapDelay,
		});
		wrapArrow.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 150,
			delay: wrapDelay + 260,
		});
		wrapLabel.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 300,
			delay: wrapDelay + 300,
		});
		// Legend settles in as the last row completes.
		legend.animate(
			[
				{ opacity: 0, transform: "translateY(8px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 400, delay: drawSpanMs - 400 },
		);
		await ctx.hold(drawSpanMs);

		// 2. Hold fully visible.
		await ctx.hold(5000);

		// 3. Leader-lined callout on RED TEAM (index 3, row 1).
		const redTeamNode = nodes[3];
		const contentRect = content.getBoundingClientRect();
		const nodeRect = redTeamNode.getBoundingClientRect();
		const startX = nodeRect.left + nodeRect.width / 2 - contentRect.left;
		const startY = nodeRect.bottom - contentRect.top;
		const endX = startX + 60;
		const endY = startY + 90;
		leaderLine.setAttribute("x1", String(startX));
		leaderLine.setAttribute("y1", String(startY));
		leaderLine.setAttribute("x2", String(endX));
		leaderLine.setAttribute("y2", String(endY));
		leaderDot.setAttribute("cx", String(startX));
		leaderDot.setAttribute("cy", String(startY));
		callout.style.left = `${endX + 16}px`;
		callout.style.top = `${endY - 14}px`;

		leader.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 300,
		});
		callout.animate(
			[
				{ opacity: 0, transform: "translateX(-10px)" },
				{ opacity: 1, transform: "translateX(0)" },
			],
			{ ...opts, duration: 400, delay: 150 },
		);
		await ctx.hold(4000);

		// 4. Fade the diagram, then reveal the closing lines, which hold to the end.
		wholeDiagram.forEach((el) => {
			el.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 500 });
		});
		await ctx.hold(600);

		const closingHead = closing.children[0] as HTMLElement;
		const closingQuote = closing.children[1] as HTMLElement;
		closing.style.opacity = "1";
		closingHead.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500 },
		);
		closingQuote.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 350 },
		);

		// Timing so far: 1500 + 16000 + 5000 + 4000 + 600 = 27100ms.
		// Remainder holds the closing composition for the rest of the 55s segment.
		await ctx.hold(27900);
	},

	unmount() {
		host = null;
	},
});
