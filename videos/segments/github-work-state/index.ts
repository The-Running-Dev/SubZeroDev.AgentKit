import { defineSegment } from "videowright";
import {
	animateSceneFrame,
	SCENE_EASE,
	sceneFrameHTML,
} from "../../components/scene-frame";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "github-work-state",
	advances: [30],
	voiceover:
		"GitHub owns the work. The repo just mirrors it. The GitHub issue is authoritative; the WorkRef in the repo is a mirror that may be stale. No dashboard. No second database of what's done.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "11",
			total: "15",
			x: "0664.00",
			y: "0412.00",
			unitLabel: "UNIT: SOURCE OF TRUTH",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 80px; top: 100px; right: 80px;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 76px;
        line-height: 1.1;
        letter-spacing: -0.01em;
        opacity: 0;
      ">GitHub owns the work. The repo just mirrors it.</div>

      <div style="position: absolute; left: 80px; right: 80px; top: 420px; height: 260px;">
        <div data-ref="nodeA" style="
          position: absolute; left: 0; top: 0; width: 480px; height: 220px;
          border: 2px solid var(--color-accent);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 0;
        ">
          <div style="font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.2em; color: var(--color-muted);">NODE A</div>
          <div style="font-family: var(--font-display); font-weight: 500; font-size: 52px; color: var(--color-fg); margin-top: 12px;">GITHUB ISSUE</div>
          <div style="font-family: var(--font-mono); font-size: 20px; letter-spacing: 0.1em; color: var(--color-accent); margin-top: 14px;">(authoritative)</div>
        </div>

        <svg data-ref="arrowSvg" style="position: absolute; left: 480px; top: 0; width: 460px; height: 220px; overflow: visible;">
          <line data-ref="arrowLine" x1="0" y1="110" x2="440" y2="110" stroke="var(--color-accent)" stroke-width="2" style="transform-origin: 0px 110px; transform: scaleX(0);" />
          <path data-ref="arrowHead" d="M 440 110 L 420 98 M 440 110 L 420 122" stroke="var(--color-accent)" stroke-width="2" fill="none" style="opacity: 0;" />
        </svg>
        <div data-ref="arrowLabel" style="
          position: absolute; left: 640px; top: 60px;
          font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.15em; color: var(--color-muted);
          opacity: 0;
        ">mirrors &rarr;</div>

        <div data-ref="nodeB" style="
          position: absolute; right: 0; top: 0; width: 480px; height: 220px;
          border: 2px solid var(--cyan);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 0;
        ">
          <div style="font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.2em; color: var(--color-muted);">NODE B</div>
          <div style="font-family: var(--font-display); font-weight: 500; font-size: 52px; color: var(--color-fg); margin-top: 12px;">WorkRef</div>
          <div style="font-family: var(--font-mono); font-size: 20px; letter-spacing: 0.1em; color: var(--cyan); margin-top: 14px;">(mirror, may be stale)</div>
        </div>
      </div>

      <div data-ref="callout" style="
        position: absolute; left: 80px; right: 80px; top: 780px;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 44px;
        line-height: 1.3;
        color: var(--color-accent);
        opacity: 0;
      ">No dashboard. No second database of what's done.</div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		animateSceneFrame(host);

		const opts = { fill: "forwards" as const, easing: SCENE_EASE };
		const heading = host.querySelector('[data-ref="heading"]') as HTMLElement;
		const nodeA = host.querySelector('[data-ref="nodeA"]') as HTMLElement;
		const nodeB = host.querySelector('[data-ref="nodeB"]') as HTMLElement;
		const arrowLine = host.querySelector(
			'[data-ref="arrowLine"]',
		) as SVGLineElement;
		const arrowHead = host.querySelector(
			'[data-ref="arrowHead"]',
		) as SVGPathElement;
		const arrowLabel = host.querySelector(
			'[data-ref="arrowLabel"]',
		) as HTMLElement;
		const callout = host.querySelector('[data-ref="callout"]') as HTMLElement;

		// Heading (~3s)
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 200 },
		);
		await ctx.hold(3000);

		// Diagram draws (~10s)
		nodeA.animate(
			[
				{ opacity: 0, transform: "translateY(16px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 420 },
		);
		await ctx.hold(600);

		arrowLine.animate(
			[{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
			{
				...opts,
				duration: 500,
			},
		);
		arrowLabel.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 300,
			delay: 200,
		});
		await ctx.hold(500);
		arrowHead.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 200,
		});
		await ctx.hold(500);

		nodeB.animate(
			[
				{ opacity: 0, transform: "translateY(16px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 420 },
		);
		await ctx.hold(8400);

		// Closing callout (~8s)
		callout.animate(
			[
				{ opacity: 0, transform: "translateY(12px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450 },
		);
		await ctx.hold(8000);

		// Hold remainder to fill 30s total
		await ctx.hold(9000);
	},

	unmount() {
		host = null;
	},
});
