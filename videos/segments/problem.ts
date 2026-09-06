import { defineSegment } from "videowright";
import {
	animateSceneFrame,
	SCENE_EASE,
	sceneFrameHTML,
} from "../components/scene-frame";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "problem",
	advances: [35],
	voiceover:
		"Agents don't lose the code. They lose the design. An expensive reasoning model reconstructs the project's current design state from prose every time it needs to work on the project. Twenty-two commits, one touched src. Fourteen thousand six hundred lines of design churn versus three thousand two hundred twenty-two lines of source. One of seventeen issues — a repo once marked done that wasn't. The artifact is the handoff, not the conversation.",
	notes:
		"Sequential beats in the same content slot: heading, then a leader-lined quote callout, then a two-part stat block, then a smaller stat, then the recurring boxed line which stays for the remainder. Earlier beats fade/lift out before the next lands.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "02",
			total: "15",
			x: "340.00",
			y: "220.00",
			unitLabel: "UNIT: PX · SCALE 1:1",
		});

		const content = host.querySelector('[data-ref="content"]') as HTMLElement;
		content.style.opacity = "1";
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; right: 0; top: 300px;
        text-align: center;
        font-family: var(--font-display);
        font-weight: 500;
        font-size: 76px;
        line-height: 1.15;
        letter-spacing: -0.01em;
        width: 100%;
        opacity: 0;
      ">Agents don&rsquo;t lose the code.<br />They lose the design.</div>

      <div data-ref="quote" style="
        position: absolute; left: 8%; right: 8%; top: 220px;
        display: flex;
        opacity: 0;
      ">
        <div style="width: 4px; background: var(--color-accent); margin-right: 40px; flex-shrink: 0;"></div>
        <div>
          <div style="
            font-family: var(--font-body);
            font-size: 34px;
            line-height: 1.45;
            color: var(--color-fg);
          ">&ldquo;An expensive reasoning model reconstructs the project&rsquo;s current design state from prose every time it needs to work on the project.&rdquo;</div>
          <div style="
            margin-top: 28px;
            font-family: var(--font-mono);
            font-size: 18px;
            letter-spacing: 0.15em;
            color: var(--color-muted);
          ">&mdash; design/00-brief.md</div>
        </div>
      </div>

      <div data-ref="stat1" style="position: absolute; left: 8%; top: 160px; width: 38%; opacity: 0;">
        <svg data-ref="stat1-dim" style="width: 100%; height: 32px; overflow: visible; display: block;">
          <line x1="0" y1="16" x2="100%" y2="16" stroke="var(--cyan)" stroke-width="1.5" style="transform-origin: 0 16px; transform: scaleX(0);" />
          <line x1="0" y1="6" x2="0" y2="26" stroke="var(--cyan)" stroke-width="1.5" style="opacity: 0;" />
        </svg>
        <div style="
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-weight: 500;
          font-size: 130px;
          line-height: 1;
          color: var(--color-accent);
          margin: 16px 0;
        ">22</div>
        <div style="
          font-family: var(--font-mono);
          font-size: 20px;
          letter-spacing: 0.1em;
          color: var(--color-fg);
        ">COMMITS &middot; 1 TOUCHED src/</div>
      </div>

      <div data-ref="stat2" style="position: absolute; right: 8%; top: 160px; width: 42%; opacity: 0;">
        <svg data-ref="stat2-dim" style="width: 100%; height: 32px; overflow: visible; display: block;">
          <line x1="0" y1="16" x2="100%" y2="16" stroke="var(--cyan)" stroke-width="1.5" style="transform-origin: 0 16px; transform: scaleX(0);" />
          <line x1="0" y1="6" x2="0" y2="26" stroke="var(--cyan)" stroke-width="1.5" style="opacity: 0;" />
        </svg>
        <div style="
          display: flex; align-items: baseline; gap: 24px;
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-weight: 500;
          font-size: 84px;
          line-height: 1;
          color: var(--color-fg);
          margin: 16px 0;
        "><span>14,600</span><span style="font-size: 32px; color: var(--color-muted);">vs</span><span>3,222</span></div>
        <div style="
          font-family: var(--font-mono);
          font-size: 18px;
          letter-spacing: 0.08em;
          color: var(--color-fg);
        ">LINES OF DESIGN CHURN vs LINES OF SOURCE</div>
      </div>

      <div data-ref="stat-caption" style="
        position: absolute; left: 0; right: 0; top: 620px;
        text-align: center;
        font-family: var(--font-mono);
        font-size: 18px;
        letter-spacing: 0.2em;
        color: var(--color-muted);
        opacity: 0;
      ">ONE SLICE LANDING ON A SIBLING REPO</div>

      <div data-ref="stat3" style="position: absolute; left: 0; right: 0; top: 300px; text-align: center; opacity: 0;">
        <div style="
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-weight: 500;
          font-size: 110px;
          line-height: 1;
          color: var(--color-accent);
        ">1 OF 17 ISSUES</div>
        <div style="
          margin-top: 24px;
          font-family: var(--font-mono);
          font-size: 22px;
          letter-spacing: 0.12em;
          color: var(--color-muted);
        ">A REPO ONCE MARKED &ldquo;DONE&rdquo; THAT WASN&rsquo;T</div>
      </div>

      <svg data-ref="pulse" style="position: absolute; inset: 0; pointer-events: none; opacity: 0;">
        <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="var(--color-accent)" stroke-width="2" />
      </svg>

      <div data-ref="finalbox" style="
        position: absolute; left: 6%; right: 6%; top: 340px;
        border: 2px solid var(--color-accent);
        padding: 64px 56px;
        text-align: center;
        opacity: 0;
      ">
        <div style="
          font-family: var(--font-display);
          font-weight: 500;
          font-size: 58px;
          line-height: 1.3;
          letter-spacing: -0.005em;
        ">THE ARTIFACT IS THE HANDOFF,<br />NOT THE CONVERSATION.</div>
      </div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		animateSceneFrame(host);
		const content = host.querySelector('[data-ref="content"]') as HTMLElement;
		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		const get = <T extends Element>(sel: string) =>
			content.querySelector(sel) as T;
		const heading = get<HTMLElement>('[data-ref="heading"]');
		const quote = get<HTMLElement>('[data-ref="quote"]');
		const stat1 = get<HTMLElement>('[data-ref="stat1"]');
		const stat2 = get<HTMLElement>('[data-ref="stat2"]');
		const statCaption = get<HTMLElement>('[data-ref="stat-caption"]');
		const stat3 = get<HTMLElement>('[data-ref="stat3"]');
		const finalbox = get<HTMLElement>('[data-ref="finalbox"]');
		const pulse = get<SVGElement>('[data-ref="pulse"]');

		const fadeIn = (el: HTMLElement, delay = 0) =>
			el.animate(
				[
					{ opacity: 0, transform: "translateY(14px)" },
					{ opacity: 1, transform: "translateY(0)" },
				],
				{ ...opts, duration: 500, delay },
			);
		const fadeOut = (el: HTMLElement) =>
			el.animate(
				[
					{ opacity: 1, transform: "translateY(0)" },
					{ opacity: 0, transform: "translateY(-14px)" },
				],
				{ ...opts, duration: 400 },
			);

		await ctx.hold(300);

		// Beat 1 — heading
		fadeIn(heading);
		await ctx.hold(3000);
		fadeOut(heading);
		await ctx.hold(400);

		// Beat 2 — leader-lined quote callout
		quote.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 500 });
		await ctx.hold(3500);
		quote.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 400 });
		await ctx.hold(400);

		// Beat 3 — stat block (two stats + shared caption), staggered 50ms
		const dim1 = stat1.querySelector("line:nth-child(1)") as SVGLineElement;
		const tick1 = stat1.querySelector("line:nth-child(2)") as SVGLineElement;
		const dim2 = stat2.querySelector("line:nth-child(1)") as SVGLineElement;
		const tick2 = stat2.querySelector("line:nth-child(2)") as SVGLineElement;

		stat1.style.opacity = "1";
		stat2.style.opacity = "1";
		dim1.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 450,
		});
		tick1.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 150,
			delay: 350,
		});
		dim2.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 450,
			delay: 50,
		});
		tick2.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 150,
			delay: 400,
		});
		fadeIn(statCaption, 500);
		await ctx.hold(4000);
		fadeOut(stat1);
		fadeOut(stat2);
		fadeOut(statCaption);
		await ctx.hold(400);

		// Beat 4 — smaller stat
		fadeIn(stat3);
		await ctx.hold(3000);
		fadeOut(stat3);
		await ctx.hold(400);

		// Beat 5 — the recurring boxed line, punctuated with a brief amber grid pulse.
		// Stays on screen for the remainder of the segment.
		finalbox.animate(
			[
				{ opacity: 0, transform: "scale(0.96)" },
				{ opacity: 1, transform: "scale(1)" },
			],
			{ ...opts, duration: 500 },
		);
		pulse.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], {
			duration: 700,
			easing: SCENE_EASE,
		});
		// (300+3000+400+3500+400+4000+400+3000+400 = 15400ms so far; remainder to 35000ms)
		await ctx.hold(19600);
	},

	unmount() {
		host = null;
	},
});
