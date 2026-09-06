import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../../components/scene-frame";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "orientation",
	advances: [35],
	voiceover:
		"Orientation reads one hop out from the unit record, not the whole corpus — the contracts it consumes, the decisions bound to it, the linked work item. That closure has a fixed budget: sixteen thousand three hundred eighty-four bytes. It does not move with project history. It once put sixteen of the kit's own units over budget. An absorption pass brought every one back under. The ceiling never moved — what got measured did.",
	notes:
		"Scene 08/15. Beats: heading (~3s), closure diagram draws (~10s), stat reveal (~8s), closing callout (~8s), hold remainder (~6s).",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "08",
			total: "15",
			x: "200.00",
			y: "280.00",
			unitLabel: "CLOSURE(U) · BUDGET",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; top: 10px; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 72px; line-height: 1.05; letter-spacing: -0.01em;
        opacity: 0;
      ">One hop. Not the whole corpus.</div>

      <div data-ref="diagramPhase" style="position: absolute; left: 0; top: 170px; width: 100%; height: 620px; opacity: 0;">
        <div data-ref="unitBox" style="
          position: absolute; left: 60px; top: 240px; width: 380px; height: 130px;
          border: 2px solid var(--color-accent); background: var(--color-surface);
          display: flex; align-items: center; justify-content: center; text-align: center;
          opacity: 0; transform: scale(0.85);
        ">
          <div style="font-family: var(--font-mono); font-size: 24px; color: var(--color-fg); padding: 0 20px;">UNIT RECORD<br/><span style="color: var(--color-muted); font-size: 18px;">e.g. /track</span></div>
        </div>

        <svg data-ref="links" style="position: absolute; inset: 0; overflow: visible;" width="1728" height="620">
          <line data-ref="link-contract" x1="440" y1="280" x2="740" y2="120" stroke="var(--cyan)" stroke-width="2" stroke-dasharray="600" stroke-dashoffset="600" />
          <line data-ref="link-decision" x1="440" y1="305" x2="740" y2="305" stroke="var(--cyan)" stroke-width="2" stroke-dasharray="600" stroke-dashoffset="600" />
          <line data-ref="link-i28" x1="440" y1="330" x2="740" y2="470" stroke="var(--cyan)" stroke-width="2" stroke-dasharray="600" stroke-dashoffset="600" />
        </svg>

        <div data-ref="node-contract" style="position: absolute; left: 740px; top: 80px; width: 460px; height: 80px; border: 1px solid var(--color-border); background: var(--color-surface); display: flex; align-items: center; padding: 0 24px; opacity: 0; transform: translateX(-14px);">
          <span style="font-family: var(--font-mono); font-size: 22px; color: var(--color-fg);">contract/test-designdrift</span>
        </div>
        <div data-ref="node-decision" style="position: absolute; left: 740px; top: 265px; width: 520px; height: 80px; border: 1px solid var(--color-border); background: var(--color-surface); display: flex; align-items: center; padding: 0 24px; opacity: 0; transform: translateX(-14px);">
          <span style="font-family: var(--font-mono); font-size: 22px; color: var(--color-fg);">decision/2026-08-03-...</span>
        </div>
        <div data-ref="node-i28" style="position: absolute; left: 740px; top: 430px; width: 220px; height: 80px; border: 1px solid var(--color-border); background: var(--color-surface); display: flex; align-items: center; justify-content: center; opacity: 0; transform: translateX(-14px);">
          <span style="font-family: var(--font-mono); font-size: 22px; color: var(--color-fg);">I28</span>
        </div>

        <svg data-ref="bracket" style="position: absolute; left: 40px; top: 8px; overflow: visible;" width="1260" height="36">
          <line x1="0" y1="18" x2="1260" y2="18" stroke="var(--color-accent)" stroke-width="1.5" style="transform-origin: 0 18px; transform: scaleX(0);" data-ref="bracketLine" />
          <line x1="0" y1="6" x2="0" y2="30" stroke="var(--color-accent)" stroke-width="1.5" style="opacity: 0;" data-ref="bracketTickL" />
          <line x1="1260" y1="6" x2="1260" y2="30" stroke="var(--color-accent)" stroke-width="1.5" style="opacity: 0;" data-ref="bracketTickR" />
        </svg>
        <div data-ref="bracketLabel" style="position: absolute; left: 40px; top: -34px; width: 1260px; text-align: center; font-family: var(--font-mono); font-size: 20px; letter-spacing: 0.2em; color: var(--color-accent); opacity: 0;">closure(U)</div>

        <div data-ref="excluded" style="position: absolute; right: 20px; top: 40px; width: 300px; height: 460px; opacity: 0;">
          <div style="position: absolute; left: 20px; top: 30px; width: 90px; height: 50px; border: 1px dashed var(--color-muted); opacity: 0.3;"></div>
          <div style="position: absolute; left: 160px; top: 90px; width: 70px; height: 50px; border: 1px dashed var(--color-muted); opacity: 0.3;"></div>
          <div style="position: absolute; left: 60px; top: 190px; width: 100px; height: 50px; border: 1px dashed var(--color-muted); opacity: 0.3;"></div>
          <div style="position: absolute; left: 190px; top: 260px; width: 80px; height: 50px; border: 1px dashed var(--color-muted); opacity: 0.3;"></div>
          <div style="position: absolute; left: 40px; top: 350px; width: 70px; height: 50px; border: 1px dashed var(--color-muted); opacity: 0.3;"></div>
          <div style="position: absolute; left: 10px; top: 130px; font-family: var(--font-mono); font-size: 40px; color: var(--color-muted); opacity: 0.4;">&times;</div>
          <div style="position: absolute; left: 150px; top: 190px; font-family: var(--font-mono); font-size: 40px; color: var(--color-muted); opacity: 0.4;">&times;</div>
          <div style="position: absolute; left: 60px; top: 330px; font-family: var(--font-mono); font-size: 40px; color: var(--color-muted); opacity: 0.4;">&times;</div>
          <div style="position: absolute; left: 0; bottom: 0; font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.15em; color: var(--color-muted);">everything else &middot; excluded</div>
        </div>
      </div>

      <div data-ref="statPhase" style="position: absolute; left: 0; top: 220px; width: 100%; opacity: 0;">
        <div style="width: 1100px; margin: 0 auto;">
          <svg data-ref="dimtop" style="width: 100%; height: 36px; overflow: visible; display: block;">
            <line x1="0" y1="18" x2="1100" y2="18" stroke="var(--cyan)" stroke-width="1.5" style="transform-origin: 0 18px; transform: scaleX(0);" data-ref="dimtopLine" />
            <line x1="0" y1="6" x2="0" y2="30" stroke="var(--cyan)" stroke-width="1.5" style="opacity: 0;" data-ref="dimtopTickL" />
            <line x1="1100" y1="6" x2="1100" y2="30" stroke="var(--cyan)" stroke-width="1.5" style="opacity: 0;" data-ref="dimtopTickR" />
          </svg>
          <div style="font-family: var(--font-display); font-weight: 500; font-size: 200px; line-height: 1.0; text-align: center; color: var(--color-accent); font-variant-numeric: tabular-nums;">
            16,384<span style="font-size: 90px;"> BYTES</span>
          </div>
          <svg data-ref="dimbot" style="width: 100%; height: 36px; overflow: visible; display: block;">
            <line x1="0" y1="18" x2="1100" y2="18" stroke="var(--cyan)" stroke-width="1.5" style="transform-origin: 0 18px; transform: scaleX(0);" data-ref="dimbotLine" />
            <line x1="0" y1="6" x2="0" y2="30" stroke="var(--cyan)" stroke-width="1.5" style="opacity: 0;" data-ref="dimbotTickL" />
            <line x1="1100" y1="6" x2="1100" y2="30" stroke="var(--cyan)" stroke-width="1.5" style="opacity: 0;" data-ref="dimbotTickR" />
          </svg>
          <div data-ref="statCaption" style="text-align: center; font-family: var(--font-mono); font-size: 24px; letter-spacing: 0.1em; color: var(--color-muted); margin-top: 24px; opacity: 0;">
            the orientation budget. Fixed. Does not move with project history.
          </div>
        </div>
      </div>

      <div data-ref="calloutPhase" style="position: absolute; left: 0; top: 320px; width: 100%; opacity: 0;">
        <div style="position: relative; border-left: 6px solid var(--warn); padding: 8px 0 8px 40px; width: 88%;">
          <div style="font-family: var(--font-body); font-size: 36px; line-height: 1.5; color: var(--color-fg);">
            Once put <span style="color: var(--warn);">16</span> of the kit's own units over budget. An absorption pass brought every one back under. The ceiling never moved &mdash; what got measured did.
          </div>
        </div>
      </div>
    `;
	},

	async play(ctx) {
		animateSceneFrame(host!);
		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		const heading = host!.querySelector('[data-ref="heading"]') as HTMLElement;
		const diagramPhase = host!.querySelector('[data-ref="diagramPhase"]') as HTMLElement;
		const statPhase = host!.querySelector('[data-ref="statPhase"]') as HTMLElement;
		const calloutPhase = host!.querySelector('[data-ref="calloutPhase"]') as HTMLElement;

		// ---- Beat 1: heading (~3s) ----
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 600 },
		);
		await ctx.hold(3000);

		// ---- Beat 2: closure diagram draws (~10s) ----
		diagramPhase.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 300 });
		const unitBox = host!.querySelector('[data-ref="unitBox"]') as HTMLElement;
		unitBox.animate(
			[
				{ opacity: 0, transform: "scale(0.85)" },
				{ opacity: 1, transform: "scale(1)" },
			],
			{ ...opts, duration: 450, delay: 150 },
		);
		await ctx.hold(700);

		const links = [
			{ line: "link-contract", node: "node-contract" },
			{ line: "link-decision", node: "node-decision" },
			{ line: "link-i28", node: "node-i28" },
		];
		for (const l of links) {
			const line = host!.querySelector(`[data-ref="${l.line}"]`) as SVGLineElement;
			const node = host!.querySelector(`[data-ref="${l.node}"]`) as HTMLElement;
			line.animate([{ strokeDashoffset: 600 }, { strokeDashoffset: 0 }], {
				...opts,
				duration: 400,
			});
			node.animate(
				[
					{ opacity: 0, transform: "translateX(-14px)" },
					{ opacity: 1, transform: "translateX(0)" },
				],
				{ ...opts, duration: 350, delay: 200 },
			);
			await ctx.hold(500);
		}

		const bracketLine = host!.querySelector('[data-ref="bracketLine"]') as SVGLineElement;
		const bracketTickL = host!.querySelector('[data-ref="bracketTickL"]') as SVGLineElement;
		const bracketTickR = host!.querySelector('[data-ref="bracketTickR"]') as SVGLineElement;
		const bracketLabel = host!.querySelector('[data-ref="bracketLabel"]') as HTMLElement;
		bracketLine.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 500,
		});
		bracketTickL.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 200 });
		bracketTickR.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 200,
			delay: 400,
		});
		bracketLabel.animate([{ opacity: 0 }, { opacity: 1 }], {
			...opts,
			duration: 300,
			delay: 500,
		});

		const excluded = host!.querySelector('[data-ref="excluded"]') as HTMLElement;
		excluded.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 400, delay: 300 });
		await ctx.hold(1300);
		await ctx.hold(7000); // hold the drawn closure diagram

		// ---- Beat 3: stat reveal (~8s) ----
		diagramPhase.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 350 });
		statPhase.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 400, delay: 250 });

		const dimtopLine = host!.querySelector('[data-ref="dimtopLine"]') as SVGLineElement;
		const dimtopTickL = host!.querySelector('[data-ref="dimtopTickL"]') as SVGLineElement;
		const dimtopTickR = host!.querySelector('[data-ref="dimtopTickR"]') as SVGLineElement;
		const dimbotLine = host!.querySelector('[data-ref="dimbotLine"]') as SVGLineElement;
		const dimbotTickL = host!.querySelector('[data-ref="dimbotTickL"]') as SVGLineElement;
		const dimbotTickR = host!.querySelector('[data-ref="dimbotTickR"]') as SVGLineElement;
		const statCaption = host!.querySelector('[data-ref="statCaption"]') as HTMLElement;

		dimtopLine.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 500,
			delay: 300,
		});
		dimtopTickL.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 200, delay: 300 });
		dimtopTickR.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 200, delay: 700 });
		await ctx.hold(1200);

		dimbotLine.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 500,
		});
		dimbotTickL.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 200 });
		dimbotTickR.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 200, delay: 400 });
		statCaption.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 400, delay: 500 });
		await ctx.hold(2000);
		await ctx.hold(6300); // hold the stat on screen

		// ---- Beat 4: closing callout (~8s) ----
		statPhase.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 350 });
		calloutPhase.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 250 },
		);
		await ctx.hold(2000);
		await ctx.hold(10000); // hold to the end of the segment
	},

	unmount() {
		host = null;
	},
});
