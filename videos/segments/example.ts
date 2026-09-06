import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../components/scene-frame";

let host: HTMLElement | null = null;

interface Node {
	name: string;
	sub?: string;
}

const NODES: Node[] = [
	{ name: "BRIEF" },
	{ name: "DESIGN", sub: "retry semantics" },
	{ name: "RED TEAM", sub: "attacks assumptions" },
	{ name: "CONTRACT", sub: "observable behavior" },
	{ name: "SLICES" },
	{ name: "SLICE", sub: "one agent, one slice" },
	{ name: "TESTS" },
	{ name: "PR GATES" },
	{ name: "RESOLVE" },
	{ name: "MERGE" },
	{ name: "TRACK" },
	{ name: "RECONCILE" },
];

const AMBER = "#ff8800";
const MUTED = "#6f8294";

function nodeHTML(node: Node, i: number): string {
	return `
    <div data-ref="node${i}" style="
      flex: 1; min-width: 0; padding: 14px 6px;
      border: 1px solid var(--color-muted);
      text-align: center;
    ">
      <div style="font-family: var(--font-mono); font-size: 14px; letter-spacing: 0.04em; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${node.name}</div>
      ${node.sub ? `<div style="font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.02em; color: var(--color-muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${node.sub}</div>` : ""}
    </div>`;
}

function connectorHTML(i: number): string {
	return `
    <div style="flex: 0 0 14px; display: flex; align-items: center;">
      <div data-ref="line${i}" style="width: 100%; height: 1.5px; background: var(--color-muted); transform-origin: 0 50%; transform: scaleX(0);"></div>
    </div>`;
}

export default defineSegment({
	id: "example",
	advances: [55],
	voiceover:
		"Add retry support to an API client. Brief, design, red team, contract, slices, slice, tests, PR gates, resolve, merge, track, reconcile. Compare that to just telling an agent to add retries and hoping. The point isn't that it writes better code by magic. It's control over where decisions get made, what survives between sessions, and what a machine can check.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "14",
			total: "15",
			x: "0812.00",
			y: "0296.00",
			unitLabel: "UNIT: PIPELINE · STAGE",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;

		let strip = "";
		NODES.forEach((node, i) => {
			strip += nodeHTML(node, i);
			if (i < NODES.length - 1) strip += connectorHTML(i);
		});

		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; top: 0; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 72px; line-height: 1.1; letter-spacing: -0.01em;
        color: var(--color-fg);
        opacity: 0;
      ">Add retry support to an API client.</div>

      <div data-ref="strip" style="
        position: absolute; left: 0; top: 200px; width: 100%;
        display: flex; align-items: stretch;
        opacity: 0;
      ">${strip}</div>

      <div data-ref="contrast" style="
        position: absolute; left: 0; top: 400px; width: 100%;
        display: flex; align-items: baseline; gap: 28px;
        opacity: 0;
      ">
        <div style="font-family: var(--font-body); font-size: 40px; color: var(--color-muted);">"Tell an agent to add retries."</div>
        <div style="font-family: var(--font-mono); font-size: 40px; color: var(--color-muted);">&rarr;</div>
        <div style="font-family: var(--font-body); font-size: 40px; color: var(--color-muted);">code.</div>
        <div style="font-family: var(--font-mono); font-size: 28px; color: var(--color-muted); opacity: 0.6;">?</div>
      </div>

      <div data-ref="closing" style="
        position: absolute; left: 0; top: 580px; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 42px; line-height: 1.4;
        color: var(--color-fg);
        opacity: 0;
      ">The point isn't that it writes better code by magic. It's control over where decisions get made, what survives between sessions, and what a machine can check.</div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		animateSceneFrame(host);

		const opts = { fill: "forwards" as const, easing: SCENE_EASE };
		const heading = host.querySelector('[data-ref="heading"]') as HTMLElement;
		const strip = host.querySelector('[data-ref="strip"]') as HTMLElement;
		const contrast = host.querySelector('[data-ref="contrast"]') as HTMLElement;
		const closing = host.querySelector('[data-ref="closing"]') as HTMLElement;

		// Heading (~3s)
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 200 },
		);
		await ctx.hold(3000);

		// Pipeline strip lights up one node at a time (~20s)
		strip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "forwards" });
		const stepMs = 1600;
		NODES.forEach((_, i) => {
			const node = host!.querySelector(`[data-ref="node${i}"]`) as HTMLElement;
			node.animate(
				[
					{ transform: "scale(1)", borderColor: MUTED, color: MUTED, boxShadow: "0 0 0 rgba(255,136,0,0)" },
					{ transform: "scale(1.08)", borderColor: AMBER, color: AMBER, boxShadow: "0 0 16px rgba(255,136,0,0.5)" },
					{ transform: "scale(1)", borderColor: AMBER, color: AMBER, boxShadow: "0 0 0 rgba(255,136,0,0)" },
				],
				{ duration: 500, delay: i * stepMs, fill: "forwards", easing: SCENE_EASE },
			);
			if (i < NODES.length - 1) {
				const line = host!.querySelector(`[data-ref="line${i}"]`) as HTMLElement;
				line.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
					...opts,
					duration: 250,
					delay: i * stepMs + 350,
				});
			}
		});
		await ctx.hold(20000);

		// Hold (~3s) on the fully-lit pipeline
		await ctx.hold(3000);

		// Contrast reveal: plain, sparse (~8s)
		contrast.animate(
			[
				{ opacity: 0, transform: "translateY(10px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450 },
		);
		await ctx.hold(8000);

		// Closing line (~10s)
		closing.animate(
			[
				{ opacity: 0, transform: "translateY(12px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500 },
		);
		await ctx.hold(10000);

		// Hold remainder to fill 55s total
		await ctx.hold(11000);
	},

	unmount() {
		host = null;
	},
});
