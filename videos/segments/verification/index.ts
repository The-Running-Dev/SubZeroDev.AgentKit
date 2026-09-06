import { defineSegment } from "videowright";
import {
	animateSceneFrame,
	SCENE_EASE,
	sceneFrameHTML,
} from "../../components/scene-frame";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "verification",
	advances: [40],
	voiceover:
		"Reasoning decides. Code verifies what code can verify. Twenty-one findings are blocking, five reports never block, and six things can't be evaluated at all. A class is only blocking if it's checkable from the checkout alone — no network, no model judgement. Absence of a finding is not a finding of absence: could-not-evaluate always outranks a finding.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "10",
			total: "15",
			x: "0412.00",
			y: "0188.00",
			unitLabel: "UNIT: EXIT CODE",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 80px; top: 80px; right: 80px;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 72px;
        line-height: 1.08;
        letter-spacing: -0.01em;
        opacity: 0;
      ">Reasoning decides. Code verifies what code can verify.</div>

      <div style="
        position: absolute; left: 80px; right: 80px; top: 340px;
        display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px;
      ">
        <div data-ref="col0" style="position: relative; padding: 36px 32px; border: 1px solid var(--color-accent); opacity: 0;">
          <div style="font-family: var(--font-mono); font-size: 14px; letter-spacing: 0.2em; color: var(--color-muted); margin-bottom: 20px;">CLASS 01</div>
          <div data-ref="num0" style="font-family: var(--font-display); font-weight: 500; font-size: 160px; line-height: 1; color: var(--color-accent); font-variant-numeric: tabular-nums;">00</div>
          <div style="font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.1em; color: var(--color-fg); margin-top: 24px;">FINDINGS</div>
          <div style="font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.1em; color: var(--color-muted); margin-top: 8px;">(blocking)</div>
        </div>

        <div data-ref="col1" style="position: relative; padding: 36px 32px; border: 1px solid var(--cyan); opacity: 0;">
          <div style="font-family: var(--font-mono); font-size: 14px; letter-spacing: 0.2em; color: var(--color-muted); margin-bottom: 20px;">CLASS 02</div>
          <div data-ref="num1" style="font-family: var(--font-display); font-weight: 500; font-size: 160px; line-height: 1; color: var(--cyan); font-variant-numeric: tabular-nums;">00</div>
          <div style="font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.1em; color: var(--color-fg); margin-top: 24px;">REPORTS</div>
          <div style="font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.1em; color: var(--color-muted); margin-top: 8px;">(never blocking)</div>
        </div>

        <div data-ref="col2" style="position: relative; padding: 36px 32px; border: 1px solid var(--warn); opacity: 0;">
          <div style="font-family: var(--font-mono); font-size: 14px; letter-spacing: 0.2em; color: var(--color-muted); margin-bottom: 20px;">CLASS 03</div>
          <div data-ref="num2" style="font-family: var(--font-display); font-weight: 500; font-size: 160px; line-height: 1; color: var(--warn); font-variant-numeric: tabular-nums;">00</div>
          <div style="font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.1em; color: var(--color-fg); margin-top: 24px;">COULD NOT</div>
          <div style="font-family: var(--font-mono); font-size: 22px; letter-spacing: 0.1em; color: var(--color-fg);">EVALUATE</div>
        </div>
      </div>

      <div data-ref="callout" style="
        position: absolute; left: 80px; right: 80px; top: 720px;
        font-family: var(--font-body);
        font-size: 32px;
        line-height: 1.4;
        color: var(--color-fg);
        opacity: 0;
      ">A class is blocking only if it's checkable from the checkout alone. No network. No model judgement.</div>

      <div data-ref="closing" style="
        position: absolute; left: 80px; right: 80px; top: 820px;
        padding: 28px 36px;
        border: 2px solid var(--color-accent);
        background: rgba(255, 136, 0, 0.06);
        opacity: 0;
      ">
        <div style="font-family: var(--font-display); font-weight: 500; font-size: 44px; color: var(--color-accent); line-height: 1.2;">"Absence of a finding is not a finding of absence."</div>
        <div style="font-family: var(--font-mono); font-size: 18px; letter-spacing: 0.05em; color: var(--color-muted); margin-top: 18px;">exit code 2 (could-not-evaluate) always outranks exit code 1 (findings)</div>
      </div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		const h = host;
		animateSceneFrame(h);

		const opts = { fill: "forwards" as const, easing: SCENE_EASE };
		const heading = h.querySelector('[data-ref="heading"]') as HTMLElement;
		const cols = [0, 1, 2].map(
			(i) => h.querySelector(`[data-ref="col${i}"]`) as HTMLElement,
		);
		const nums = [0, 1, 2].map(
			(i) => h.querySelector(`[data-ref="num${i}"]`) as HTMLElement,
		);
		const callout = h.querySelector('[data-ref="callout"]') as HTMLElement;
		const closing = h.querySelector('[data-ref="closing"]') as HTMLElement;

		// Heading (~3s)
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 200 },
		);
		await ctx.hold(3000);

		// Three columns reveal, staggered left to right (~10s)
		const targets = [21, 5, 6];
		cols.forEach((col, i) => {
			col.animate(
				[
					{ opacity: 0, transform: "translateY(16px)" },
					{ opacity: 1, transform: "translateY(0)" },
				],
				{ ...opts, duration: 400, delay: i * 350 },
			);
		});

		// Count up each number after its card starts revealing
		const countUp = async (
			el: HTMLElement,
			target: number,
			startDelay: number,
		) => {
			await ctx.hold(startDelay);
			const steps = 12;
			for (let s = 1; s <= steps; s++) {
				const progress = s / steps;
				const eased = 1 - (1 - progress) ** 3;
				el.textContent = String(Math.round(eased * target)).padStart(2, "0");
				await ctx.hold(40);
			}
			el.textContent = String(target).padStart(2, "0");
		};

		await Promise.all([
			countUp(nums[0], targets[0], 250),
			countUp(nums[1], targets[1], 600),
			countUp(nums[2], targets[2], 950),
		]);

		await ctx.hold(10000 - 250 - 12 * 40 - 950);

		// Callout (~8s)
		callout.animate(
			[
				{ opacity: 0, transform: "translateY(12px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450 },
		);
		await ctx.hold(8000);

		// Closing beat (~8s)
		closing.animate(
			[
				{ opacity: 0, transform: "scaleY(0.85)" },
				{ opacity: 1, transform: "scaleY(1)" },
			],
			{ ...opts, duration: 500 },
		);
		await ctx.hold(8000);

		// Hold remainder to fill 40s total
		await ctx.hold(11250);
	},

	unmount() {
		host = null;
	},
});
