import { defineSegment } from "videowright";
import {
	animateSceneFrame,
	SCENE_EASE,
	sceneFrameHTML,
} from "../components/scene-frame";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "title",
	advances: [20],
	voiceover:
		"AgentKit. A controlled software-engineering pipeline for AI coding agents. How does an agent go from improv to controlled pipeline?",
	notes:
		"Title card. Silent render — all pacing via ctx.hold(). Reticle settles, title reveals, dimension line brackets it, subtitle + question line land, then a long hold to let the card sit.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "01",
			total: "15",
			x: "960.00",
			y: "540.00",
			unitLabel: "UNIT: PX · SCALE 1:1",
		});

		const content = host.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <svg data-ref="reticle" style="
        position: absolute; left: 50%; top: 110px;
        width: 72px; height: 72px; transform: translate(-50%, -50%) scale(1.4);
        overflow: visible; opacity: 0;
      ">
        <line x1="0" y1="36" x2="72" y2="36" stroke="var(--color-accent)" stroke-width="1.5" />
        <line x1="36" y1="0" x2="36" y2="72" stroke="var(--color-accent)" stroke-width="1.5" />
        <circle cx="36" cy="36" r="10" fill="none" stroke="var(--color-accent)" stroke-width="1.5" />
      </svg>

      <div data-ref="title" style="
        position: absolute; left: 0; right: 0; top: 250px;
        text-align: center;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 156px;
        letter-spacing: -0.01em;
        line-height: 1;
        opacity: 0;
      ">AGENTKIT</div>

      <svg data-ref="dimline" style="
        position: absolute; left: 50%; top: 470px;
        width: 980px; height: 40px; transform: translateX(-50%);
        overflow: visible;
      ">
        <line x1="0" y1="20" x2="980" y2="20" stroke="var(--cyan)" stroke-width="1.5" style="transform-origin: 0 20px; transform: scaleX(0);" />
        <line x1="0" y1="10" x2="0" y2="30" stroke="var(--cyan)" stroke-width="1.5" style="opacity: 0;" />
        <line x1="980" y1="10" x2="980" y2="30" stroke="var(--cyan)" stroke-width="1.5" style="opacity: 0;" />
      </svg>

      <div data-ref="subtitle" style="
        position: absolute; left: 0; right: 0; top: 540px;
        text-align: center;
        font-family: var(--font-mono);
        font-size: 22px;
        letter-spacing: 0.25em;
        color: var(--color-muted);
        opacity: 0;
      ">CONTROLLED SOFTWARE-ENGINEERING PIPELINE FOR AI CODING AGENTS</div>

      <div data-ref="question" style="
        position: absolute; left: 0; right: 0; top: 640px;
        text-align: center;
        font-family: var(--font-mono);
        font-size: 17px;
        letter-spacing: 0.15em;
        color: var(--color-accent);
        opacity: 0;
      ">HOW DOES AN AGENT GO FROM IMPROV TO CONTROLLED PIPELINE?</div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		animateSceneFrame(host);

		const content = host.querySelector('[data-ref="content"]') as HTMLElement;
		const reticle = content.querySelector('[data-ref="reticle"]') as SVGElement;
		const title = content.querySelector('[data-ref="title"]') as HTMLElement;
		const dimline = content.querySelector('[data-ref="dimline"]') as SVGElement;
		const dimMain = dimline.querySelector(
			"line:nth-child(1)",
		) as SVGLineElement;
		const dimTickL = dimline.querySelector(
			"line:nth-child(2)",
		) as SVGLineElement;
		const dimTickR = dimline.querySelector(
			"line:nth-child(3)",
		) as SVGLineElement;
		const subtitle = content.querySelector(
			'[data-ref="subtitle"]',
		) as HTMLElement;
		const question = content.querySelector(
			'[data-ref="question"]',
		) as HTMLElement;

		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		// Content slot fades in (chrome already handled by animateSceneFrame).
		content.style.opacity = "1";

		// 1. Reticle tracks to center (~1.5s)
		reticle.animate(
			[
				{ opacity: 0, transform: "translate(-50%, -50%) scale(1.4)" },
				{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
			],
			{ ...opts, duration: 900 },
		);
		await ctx.hold(1500);

		// 2. Title reveals with geometry (~1s)
		title.animate(
			[
				{ opacity: 0, transform: "translateY(16px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 600 },
		);
		await ctx.hold(1000);

		// 3. Dimension line brackets the title (~0.8s)
		dimMain.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 500,
		});
		dimTickL.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 150,
		});
		dimTickR.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 150,
			delay: 400,
		});
		await ctx.hold(800);

		// 4. Subtitle + question line land (~1s), staggered 50ms
		subtitle.animate(
			[
				{ opacity: 0, transform: "translateY(10px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 420 },
		);
		question.animate(
			[
				{ opacity: 0, transform: "translateY(10px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 420, delay: 50 },
		);
		await ctx.hold(1000);

		// 5. Hold on the full composition — this is a title card, let it sit.
		// Total so far: 1500 + 1000 + 800 + 1000 = 4300ms; remainder brings us to 20000ms.
		await ctx.hold(15700);
	},

	unmount() {
		host = null;
	},
});
