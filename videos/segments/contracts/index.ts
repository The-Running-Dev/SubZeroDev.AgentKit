import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../../components/scene-frame";

let host: HTMLElement | null = null;

const LEVELS = ["BRIEF", "CONTRACT", "DESIGN", "SLICES", "DECISION LOG"];
const ROW_H = 130;
const STACK_TOP = 150;
const CONTRACT_INDEX = 1;

function levelRowHTML(label: string, i: number): string {
	const top = STACK_TOP + i * ROW_H;
	const isContract = i === CONTRACT_INDEX;
	const boxBorder = isContract ? "var(--color-accent)" : "var(--color-border)";
	const textColor = isContract ? "var(--color-accent)" : "var(--color-fg)";
	return `
    <div data-ref="tick${i}" style="
      position: absolute; left: 26px; top: ${top + 31}px; width: 16px; height: 1.5px;
      background: var(--color-muted);
      transform-origin: 0 50%; transform: scaleX(0);
    "></div>
    <div data-ref="level${i}" style="
      position: absolute; left: 70px; top: ${top}px; width: 520px; height: 64px;
      box-sizing: border-box; border: 1.5px solid ${boxBorder};
      display: flex; align-items: center; padding: 0 24px;
      opacity: 0;
    ">
      <div style="
        font-family: var(--font-mono); font-size: 28px; letter-spacing: 0.06em;
        color: ${textColor}; text-transform: uppercase;
      ">${label}</div>
    </div>`;
}

export default defineSegment({
	id: "contracts",
	advances: [35],
	voiceover:
		"The contract is what the tree cannot say. Authority runs from brief to contract to design to slices to the decision log. A param block declares the shape. The contract states only what code can't: which field means what, under which state, what must never default. An implementation agent is not authorized to quietly redesign the system because implementation became inconvenient.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "06",
			total: "15",
			x: "0230.00",
			y: "0480.00",
			unitLabel: "UNIT: LEVEL · AUTHORITY",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; top: 0; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 70px; line-height: 1.1; letter-spacing: -0.01em;
        color: var(--color-fg);
        opacity: 0;
      ">The contract is what the tree cannot say.</div>

      <div data-ref="vline" style="
        position: absolute; left: 34px; top: ${STACK_TOP}px; width: 1.5px;
        height: ${(LEVELS.length - 1) * ROW_H + 64}px;
        background: var(--color-muted);
        transform-origin: 50% 0; transform: scaleY(0);
      "></div>

      ${LEVELS.map(levelRowHTML).join("")}

      <div data-ref="leader" style="
        position: absolute; left: 590px; top: ${STACK_TOP + CONTRACT_INDEX * ROW_H + 31}px;
        width: 140px; height: 1.5px; background: var(--color-accent);
        transform-origin: 0 50%; transform: scaleX(0);
      "></div>

      <div data-ref="callout" style="
        position: absolute; left: 730px; top: 220px; width: 940px;
        font-family: var(--font-body); font-size: 28px; line-height: 1.5;
        color: var(--color-fg);
        opacity: 0;
      ">A <span style="font-family: var(--font-mono); font-size: 26px; background: var(--color-surface); border: 1px solid var(--color-border); padding: 2px 8px; color: var(--cyan);">param</span> block declares the shape. The contract states only what code can&rsquo;t: which field means what, under which state, what must never default.</div>

      <div data-ref="closing" style="
        position: absolute; left: 0; top: 776px; width: 100%;
        opacity: 0;
      ">
        <div data-ref="closingRule" style="
          width: 100%; height: 1.5px; background: var(--color-accent); margin-bottom: 20px;
          transform-origin: 0 50%; transform: scaleX(0);
        "></div>
        <div style="
          font-family: var(--font-display); font-weight: 500; font-size: 40px; line-height: 1.22;
          color: var(--color-fg);
        ">An implementation agent is <span style="color: var(--color-accent);">not authorized</span> to quietly redesign the system because implementation became inconvenient.</div>
      </div>
    `;
	},

	async play(ctx) {
		const h = host;
		if (!h) throw new Error("contracts: play() called before mount()");
		animateSceneFrame(h);
		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		const heading = h.querySelector('[data-ref="heading"]') as HTMLElement;
		const vline = h.querySelector('[data-ref="vline"]') as HTMLElement;
		const leader = h.querySelector('[data-ref="leader"]') as HTMLElement;
		const callout = h.querySelector('[data-ref="callout"]') as HTMLElement;
		const closing = h.querySelector('[data-ref="closing"]') as HTMLElement;
		const closingRule = h.querySelector('[data-ref="closingRule"]') as HTMLElement;

		// Phase 1: heading
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 200 },
		);
		await ctx.hold(2000);

		// Phase 2: authority stack draws top to bottom, like a vertical measurement scale
		vline.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
			...opts,
			duration: 900,
		});
		LEVELS.forEach((_, i) => {
			const tick = h.querySelector(`[data-ref="tick${i}"]`) as HTMLElement;
			const level = h.querySelector(`[data-ref="level${i}"]`) as HTMLElement;
			const delay = 200 + i * 500;
			tick.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
				...opts,
				duration: 250,
				delay,
			});
			level.animate(
				[
					{ opacity: 0, transform: "translateX(-10px)" },
					{ opacity: 1, transform: "translateX(0)" },
				],
				{ ...opts, duration: 400, delay: delay + 80 },
			);
		});
		await ctx.hold(5500);

		// Phase 3: leader-lined callout on the CONTRACT level
		leader.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 350,
		});
		callout.animate(
			[
				{ opacity: 0, transform: "translateY(8px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 450, delay: 250 },
		);
		await ctx.hold(4000);

		// Phase 4: closing line
		closingRule.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 500,
		});
		closing.animate(
			[
				{ opacity: 0, transform: "translateY(12px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 150 },
		);
		await ctx.hold(4000);

		// Hold on full composition
		await ctx.hold(19500);
	},

	unmount() {
		host = null;
	},
});
