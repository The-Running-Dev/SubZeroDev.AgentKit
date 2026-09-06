import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../components/scene-frame";

let host: HTMLElement | null = null;

interface Phase {
	name: string;
	sub?: string;
}

const PHASES: Phase[] = [
	{ name: "ORIENT" },
	{ name: "CLASSIFY" },
	{ name: "RECONCILE", sub: "(propose, write nothing)" },
	{ name: "APPLY", sub: "(feature branch + PR)" },
];

function phaseHTML(phase: Phase, i: number): string {
	return `
    <div data-ref="phase${i}" style="
      flex: 1; margin: 0 10px; padding: 28px 20px;
      border: 1px solid var(--color-accent);
      text-align: center;
      opacity: 0;
    ">
      <div style="font-family: var(--font-mono); font-size: 14px; letter-spacing: 0.2em; color: var(--color-muted); margin-bottom: 14px;">PHASE 0${i + 1}</div>
      <div style="font-family: var(--font-display); font-weight: 500; font-size: 32px; letter-spacing: 0.01em; color: var(--color-fg);">${phase.name}</div>
      ${phase.sub ? `<div style="font-family: var(--font-mono); font-size: 16px; color: var(--color-muted); margin-top: 10px;">${phase.sub}</div>` : ""}
    </div>`;
}

function arrowHTML(i: number): string {
	return `
    <div data-ref="arrow${i}" style="
      flex: 0 0 48px;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-mono); font-size: 32px; color: var(--color-muted);
      opacity: 0;
    ">&rarr;</div>`;
}

export default defineSegment({
	id: "install-reuse",
	advances: [35],
	voiceover:
		"Installing is reconciliation, not overwrite. Orient, classify, reconcile by proposing without writing, then apply on a feature branch and PR. Core command files are kit-owned and cross-repo; companion files are repo-specific. Thirteen genuinely divergent command files in one repo alone — real specialization, not drift.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "13",
			total: "15",
			x: "0620.00",
			y: "0344.00",
			unitLabel: "UNIT: RECONCILE · PASS 1",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; top: 0; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 72px; line-height: 1.1; letter-spacing: -0.01em;
        color: var(--color-fg);
        opacity: 0;
      ">Installing is reconciliation. <span style="color: var(--color-accent);">Not overwrite.</span></div>

      <div data-ref="phaseRow" style="
        position: absolute; left: 0; top: 190px; width: 100%;
        display: flex; align-items: stretch;
      ">
        ${phaseHTML(PHASES[0], 0)}
        ${arrowHTML(0)}
        ${phaseHTML(PHASES[1], 1)}
        ${arrowHTML(1)}
        ${phaseHTML(PHASES[2], 2)}
        ${arrowHTML(2)}
        ${phaseHTML(PHASES[3], 3)}
      </div>

      <div data-ref="split" style="
        position: absolute; left: 0; top: 420px; width: 100%; height: 300px;
        display: flex; align-items: stretch;
      ">
        <div data-ref="splitLeft" style="flex: 1; padding-right: 56px; opacity: 0;">
          <div style="font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.2em; color: var(--color-accent); margin-bottom: 16px;">CORE</div>
          <div style="font-family: var(--font-mono); font-size: 24px; color: var(--color-fg); margin-bottom: 20px;">.claude/commands/*.md</div>
          <div style="font-family: var(--font-body); font-size: 30px; line-height: 1.4; color: var(--color-muted);">Kit-owned, cross-repo, never edited locally.</div>
        </div>
        <div data-ref="divider" style="width: 1px; background: var(--color-muted); transform-origin: 50% 0; transform: scaleY(0);"></div>
        <div data-ref="splitRight" style="flex: 1; padding-left: 56px; opacity: 0;">
          <div style="font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.2em; color: var(--cyan); margin-bottom: 16px;">COMPANION</div>
          <div style="font-family: var(--font-mono); font-size: 24px; color: var(--color-fg); margin-bottom: 20px;">*-local.md</div>
          <div style="font-family: var(--font-body); font-size: 30px; line-height: 1.4; color: var(--color-muted);">Repo-specific: vocabulary, doc paths, extra steps, tighter authorization only.</div>
        </div>
      </div>

      <div data-ref="closing" style="
        position: absolute; left: 0; top: 780px; width: 100%;
        padding: 28px 36px;
        border-left: 3px solid var(--color-accent);
        opacity: 0;
      ">
        <div style="font-family: var(--font-display); font-weight: 500; font-size: 38px; line-height: 1.3; color: var(--color-fg);"><span style="color: var(--color-accent);">13</span> genuinely divergent command files in one repo alone &mdash; real specialization, not drift.</div>
      </div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		animateSceneFrame(host);

		const opts = { fill: "forwards" as const, easing: SCENE_EASE };
		const heading = host.querySelector('[data-ref="heading"]') as HTMLElement;
		const splitLeft = host.querySelector('[data-ref="splitLeft"]') as HTMLElement;
		const splitRight = host.querySelector('[data-ref="splitRight"]') as HTMLElement;
		const divider = host.querySelector('[data-ref="divider"]') as HTMLElement;
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

		// Four-phase row, left to right, staggered (~10s)
		for (let i = 0; i < PHASES.length; i++) {
			const phase = host.querySelector(`[data-ref="phase${i}"]`) as HTMLElement;
			phase.animate(
				[
					{ opacity: 0, transform: "translateY(16px)" },
					{ opacity: 1, transform: "translateY(0)" },
				],
				{ ...opts, duration: 400, delay: i * 500 },
			);
			if (i < PHASES.length - 1) {
				const arrow = host.querySelector(`[data-ref="arrow${i}"]`) as HTMLElement;
				arrow.animate([{ opacity: 0 }, { opacity: 1 }], {
					...opts,
					duration: 300,
					delay: i * 500 + 350,
				});
			}
		}
		await ctx.hold(10000);

		// Split callout: left, divider, right (~12s)
		splitLeft.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450 },
		);
		divider.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
			...opts,
			duration: 400,
			delay: 100,
		});
		splitRight.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450, delay: 200 },
		);
		await ctx.hold(12000);

		// Closing stat (~6s)
		closing.animate(
			[
				{ opacity: 0, transform: "translateY(12px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450 },
		);
		await ctx.hold(6000);

		// Hold remainder to fill 35s total
		await ctx.hold(4000);
	},

	unmount() {
		host = null;
	},
});
