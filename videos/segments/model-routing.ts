import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../components/scene-frame";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "model-routing",
	advances: [35],
	voiceover:
		"Reasoning cost follows complexity and reversibility, not file size. Deep reasoning is for architecture, contracts, and root-cause work. Implementation is code against a settled contract, tests, CI. Running stage six, implementation, on the top tier is the classic waste — a one-line change to an invariant is architectural, a five-hundred-line transcription against a settled contract is not.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "05",
			total: "15",
			x: "0710.00",
			y: "0340.00",
			unitLabel: "UNIT: TIER · REASONING COST",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; top: 0; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 68px; line-height: 1.1; letter-spacing: -0.01em;
        color: var(--color-fg);
        opacity: 0;
      ">Reasoning cost follows complexity and reversibility. <span style="color: var(--color-muted);">Not file size.</span></div>

      <div style="position: absolute; left: 0; top: 210px; width: 100%; height: 270px; display: flex; gap: 32px;">
        <div data-ref="boxA" style="
          flex: 1; height: 100%; box-sizing: border-box;
          border: 2px solid var(--color-accent); padding: 32px;
          display: flex; flex-direction: column; justify-content: center; gap: 20px;
          clip-path: inset(0 100% 0 0); opacity: 0;
        ">
          <div style="
            font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.15em;
            color: var(--color-accent);
          ">TIER 01</div>
          <div style="
            font-family: var(--font-display); font-weight: 500; font-size: 56px;
            color: var(--color-accent); line-height: 1;
          ">DEEP REASONING</div>
          <div style="
            font-family: var(--font-body); font-size: 28px; color: var(--color-fg);
          ">architecture, contracts, root-cause</div>
        </div>
        <div data-ref="boxB" style="
          flex: 1; height: 100%; box-sizing: border-box;
          border: 2px solid var(--cyan); padding: 32px;
          display: flex; flex-direction: column; justify-content: center; gap: 20px;
          clip-path: inset(0 100% 0 0); opacity: 0;
        ">
          <div style="
            font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.15em;
            color: var(--cyan);
          ">TIER 02</div>
          <div style="
            font-family: var(--font-display); font-weight: 500; font-size: 56px;
            color: var(--cyan); line-height: 1;
          ">IMPLEMENTATION</div>
          <div style="
            font-family: var(--font-body); font-size: 28px; color: var(--color-fg);
          ">code against a settled contract, tests, CI</div>
        </div>
      </div>

      <div data-ref="stat" style="
        position: absolute; left: 0; top: 528px; width: 100%;
        display: flex; align-items: center; gap: 20px;
        opacity: 0;
      ">
        <div style="
          font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.06em;
          color: var(--warn); text-decoration: line-through; text-decoration-thickness: 2px;
          border: 1.5px solid var(--warn); padding: 6px 14px;
          flex-shrink: 0;
        ">STAGE 6 · IMPLEMENT</div>
        <div style="
          font-family: var(--font-body); font-size: 32px; color: var(--color-fg);
        ">on the top tier &mdash; <span style="color: var(--warn);">the classic waste.</span></div>
      </div>

      <div data-ref="annotation" style="
        position: absolute; left: 0; top: 640px; width: 92%;
        font-family: var(--font-mono); font-size: 24px; line-height: 1.5;
        color: var(--color-muted);
        border-left: 2px solid var(--color-border); padding-left: 20px;
        opacity: 0;
      ">A one-line change to an invariant is architectural. A 500-line transcription against a settled contract is not.</div>
    `;
	},

	async play(ctx) {
		animateSceneFrame(host!);
		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		const heading = host!.querySelector('[data-ref="heading"]') as HTMLElement;
		const boxA = host!.querySelector('[data-ref="boxA"]') as HTMLElement;
		const boxB = host!.querySelector('[data-ref="boxB"]') as HTMLElement;
		const stat = host!.querySelector('[data-ref="stat"]') as HTMLElement;
		const annotation = host!.querySelector('[data-ref="annotation"]') as HTMLElement;

		// Phase 1: heading
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 200 },
		);
		await ctx.hold(2000);

		// Phase 2: two tier boxes draw in side by side, left-to-right wipe
		boxA.animate(
			[
				{ opacity: 0, clipPath: "inset(0 100% 0 0)" },
				{ opacity: 1, clipPath: "inset(0 0% 0 0)" },
			],
			{ ...opts, duration: 600 },
		);
		boxB.animate(
			[
				{ opacity: 0, clipPath: "inset(0 100% 0 0)" },
				{ opacity: 1, clipPath: "inset(0 0% 0 0)" },
			],
			{ ...opts, duration: 600, delay: 150 },
		);
		await ctx.hold(3000);

		// Phase 3: stat callout
		stat.animate(
			[
				{ opacity: 0, transform: "translateY(10px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450 },
		);
		await ctx.hold(3000);

		// Phase 4: annotation line
		annotation.animate(
			[
				{ opacity: 0, transform: "translateY(8px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450 },
		);
		await ctx.hold(3000);

		// Hold on full composition
		await ctx.hold(24000);
	},

	unmount() {
		host = null;
	},
});
