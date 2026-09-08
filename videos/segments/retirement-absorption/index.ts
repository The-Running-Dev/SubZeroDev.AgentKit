import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../../components/scene-frame";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "retirement-absorption",
	advances: [35],
	voiceover:
		"State leaves the active set two ways. Retirement moves a record into a retired companion file — gone, but the id still resolves. Absorption moves a live claim into the site it now describes — still true, just moved address. Nothing retires; a claim changes address.",
	notes:
		"Scene 09/15. Beats: heading (~3s), left column RETIREMENT (~8s), right column ABSORPTION (~8s), closing quote (~6s), hold remainder (~10s).",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "09",
			total: "15",
			x: "060.00",
			y: "200.00",
			unitLabel: "STATE EXIT PATHS · N=2",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; top: 10px; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 72px; line-height: 1.05; letter-spacing: -0.01em;
        opacity: 0;
      ">Two ways state leaves the active set.</div>

      <div data-ref="diagram" style="position: absolute; left: 0; top: 190px; width: 100%; height: 560px;">
        <div data-ref="divider" style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--color-border); transform: translateX(-50%) scaleY(0); transform-origin: top; opacity: 0;"></div>

        <div data-ref="leftCol" style="position: absolute; left: 0; top: 0; width: 48%; opacity: 0;">
          <div style="font-family: var(--font-mono); font-size: 24px; letter-spacing: 0.2em; color: var(--color-accent); margin-bottom: 40px;">RETIREMENT</div>

          <div data-ref="left-box1" style="position: absolute; left: 0; top: 100px; width: 260px; height: 110px; border: 1px solid var(--color-border); background: var(--color-surface); display: flex; align-items: center; justify-content: center;">
            <span style="font-family: var(--font-mono); font-size: 26px; color: var(--color-fg);">record</span>
          </div>

          <svg data-ref="left-arrow-svg" style="position: absolute; left: 260px; top: 148px; overflow: visible;" width="130" height="20">
            <line x1="0" y1="10" x2="120" y2="10" stroke="var(--cyan)" stroke-width="2" style="transform-origin: 0 10px; transform: scaleX(0);" data-ref="left-arrow-line" />
            <path d="M 112 3 L 122 10 L 112 17" fill="none" stroke="var(--cyan)" stroke-width="2" style="opacity: 0;" data-ref="left-arrow-head" />
          </svg>

          <div data-ref="left-box2" style="position: absolute; left: 410px; top: 100px; width: 280px; height: 110px; border: 1px solid var(--color-muted); background: var(--color-surface); display: flex; align-items: center; justify-content: center; text-align: center; opacity: 0; transform: translateX(-100px);">
            <span style="font-family: var(--font-mono); font-size: 20px; color: var(--color-muted);">retired/<br/>companion file</span>
          </div>

          <div data-ref="left-caption" style="position: absolute; left: 0; top: 260px; width: 100%; font-family: var(--font-mono); font-size: 18px; letter-spacing: 0.08em; color: var(--color-muted); opacity: 0;">gone, but the id still resolves</div>
        </div>

        <div data-ref="rightCol" style="position: absolute; right: 0; top: 0; width: 48%; opacity: 0;">
          <div style="font-family: var(--font-mono); font-size: 24px; letter-spacing: 0.2em; color: var(--cyan); margin-bottom: 40px;">ABSORPTION</div>

          <div data-ref="right-box1" style="position: absolute; left: 0; top: 100px; width: 260px; height: 110px; border: 1px solid var(--color-border); background: var(--color-surface); display: flex; align-items: center; justify-content: center;">
            <span style="font-family: var(--font-mono); font-size: 26px; color: var(--color-accent);">Live</span>
          </div>

          <svg data-ref="right-arrow-svg" style="position: absolute; left: 260px; top: 148px; overflow: visible;" width="130" height="20">
            <line x1="0" y1="10" x2="120" y2="10" stroke="var(--cyan)" stroke-width="2" style="transform-origin: 0 10px; transform: scaleX(0);" data-ref="right-arrow-line" />
            <path d="M 112 3 L 122 10 L 112 17" fill="none" stroke="var(--cyan)" stroke-width="2" style="opacity: 0;" data-ref="right-arrow-head" />
          </svg>

          <div data-ref="right-box2" style="position: absolute; left: 410px; top: 100px; width: 280px; height: 110px; border: 1px solid var(--cyan); background: var(--color-surface); display: flex; align-items: center; justify-content: center; text-align: center; opacity: 0; transform: translateX(-100px);">
            <span style="font-family: var(--font-mono); font-size: 20px; color: var(--cyan);">StatedIn site</span>
          </div>

          <div data-ref="right-caption" style="position: absolute; left: 0; top: 260px; width: 100%; font-family: var(--font-mono); font-size: 18px; letter-spacing: 0.08em; color: var(--color-muted); opacity: 0;">still true &mdash; just moved address</div>
        </div>
      </div>

      <div data-ref="quotePhase" style="position: absolute; left: 0; top: 340px; width: 100%; opacity: 0;">
        <div style="position: relative; border: 2px solid var(--color-accent); padding: 48px 56px; width: 88%; margin: 0 auto;">
          <div style="position: absolute; left: -2px; top: -2px; width: 20px; height: 20px;">
            <div style="position: absolute; left: 0; top: 0; width: 20px; height: 2px; background: var(--color-accent);"></div>
            <div style="position: absolute; left: 0; top: 0; width: 2px; height: 20px; background: var(--color-accent);"></div>
          </div>
          <div style="position: absolute; right: -2px; bottom: -2px; width: 20px; height: 20px;">
            <div style="position: absolute; right: 0; bottom: 0; width: 20px; height: 2px; background: var(--color-accent);"></div>
            <div style="position: absolute; right: 0; bottom: 0; width: 2px; height: 20px; background: var(--color-accent);"></div>
          </div>
          <div style="font-family: var(--font-display); font-style: italic; font-size: 56px; line-height: 1.3; text-align: center; color: var(--color-fg);">
            &ldquo;Nothing retires; a claim changes address.&rdquo;
          </div>
        </div>
      </div>
    `;
	},

	async play(ctx) {
		const h = host;
		if (!h) throw new Error("retirement-absorption: play() called before mount()");
		animateSceneFrame(h);
		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		const heading = h.querySelector('[data-ref="heading"]') as HTMLElement;
		const leftCol = h.querySelector('[data-ref="leftCol"]') as HTMLElement;
		const rightCol = h.querySelector('[data-ref="rightCol"]') as HTMLElement;
		const divider = h.querySelector('[data-ref="divider"]') as HTMLElement;
		const diagram = h.querySelector('[data-ref="diagram"]') as HTMLElement;
		const quotePhase = h.querySelector('[data-ref="quotePhase"]') as HTMLElement;

		// ---- Beat 1: heading (~3s) ----
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 600 },
		);
		await ctx.hold(3000);

		divider.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 300 });
		divider.animate(
			[
				{ transform: "translateX(-50%) scaleY(0)" },
				{ transform: "translateX(-50%) scaleY(1)" },
			],
			{ ...opts, duration: 500 },
		);

		// ---- Beat 2: left column, RETIREMENT (~8s) ----
		leftCol.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 300, delay: 200 });
		await ctx.hold(600);

		const leftArrowLine = h.querySelector('[data-ref="left-arrow-line"]') as SVGLineElement;
		const leftArrowHead = h.querySelector('[data-ref="left-arrow-head"]') as SVGPathElement;
		const leftBox2 = h.querySelector('[data-ref="left-box2"]') as HTMLElement;
		const leftCaption = h.querySelector('[data-ref="left-caption"]') as HTMLElement;

		leftArrowLine.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 450,
		});
		leftArrowHead.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 200,
			delay: 400,
		});
		await ctx.hold(600);

		leftBox2.animate(
			[
				{ opacity: 0, transform: "translateX(-100px)" },
				{ opacity: 1, transform: "translateX(0)" },
			],
			{ ...opts, duration: 500 },
		);
		await ctx.hold(600);

		leftCaption.animate(
			[
				{ opacity: 0, transform: "translateY(8px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 350 },
		);
		await ctx.hold(1000);
		await ctx.hold(5200); // hold retirement column on screen

		// ---- Beat 3: right column, ABSORPTION (~8s) ----
		rightCol.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 300 });
		await ctx.hold(600);

		const rightArrowLine = h.querySelector('[data-ref="right-arrow-line"]') as SVGLineElement;
		const rightArrowHead = h.querySelector('[data-ref="right-arrow-head"]') as SVGPathElement;
		const rightBox2 = h.querySelector('[data-ref="right-box2"]') as HTMLElement;
		const rightCaption = h.querySelector('[data-ref="right-caption"]') as HTMLElement;

		rightArrowLine.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 450,
		});
		rightArrowHead.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 200,
			delay: 400,
		});
		await ctx.hold(600);

		rightBox2.animate(
			[
				{ opacity: 0, transform: "translateX(-100px)" },
				{ opacity: 1, transform: "translateX(0)" },
			],
			{ ...opts, duration: 500 },
		);
		await ctx.hold(600);

		rightCaption.animate(
			[
				{ opacity: 0, transform: "translateY(8px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 350 },
		);
		await ctx.hold(1000);
		await ctx.hold(5200); // hold absorption column on screen

		// ---- Beat 4: closing quote (~6s, held to end) ----
		diagram.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 350 });
		quotePhase.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 250 },
		);
		await ctx.hold(1500);
		await ctx.hold(14500); // hold the closing quote for the remainder of the segment
	},

	unmount() {
		host = null;
	},
});
