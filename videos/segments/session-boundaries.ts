import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../components/scene-frame";

let host: HTMLElement | null = null;

interface Row {
	left: string;
	label: string; // HTML with <span class="hi-amber"> or <span class="hi-cyan"> around the boundary word
	right: string;
}

const ROWS: Row[] = [
	{
		left: "DESIGN",
		label: '<span data-hi="amber">fresh</span> session, different vendor',
		right: "RED TEAM",
	},
	{
		left: "SLICES",
		label: '<span data-hi="amber">fresh</span> session, one slice',
		right: "SLICE",
	},
	{
		left: "SLICE",
		label: '<span data-hi="cyan">same</span> session',
		right: "PR/VERIFY",
	},
	{
		left: "MERGE",
		label: '<span data-hi="amber">fresh</span> session',
		right: "TRACK",
	},
	{
		left: "IMPLEMENTATION",
		label: '<span data-hi="amber">fresh</span> session',
		right: "RECONCILE",
	},
];

function rowHTML(row: Row, i: number): string {
	const top = 176 + i * 72;
	const label = row.label
		.replace(
			'data-hi="amber"',
			'style="color: var(--color-accent);"',
		)
		.replace('data-hi="cyan"', 'style="color: var(--cyan);"');
	return `
    <div data-ref="row${i}" style="
      position: absolute; left: 0; top: ${top}px; width: 100%; height: 56px;
      display: flex; align-items: center; gap: 20px;
      opacity: 0;
    ">
      <div style="
        width: 320px; flex-shrink: 0;
        font-family: var(--font-mono); font-size: 26px; letter-spacing: 0.04em;
        color: var(--color-muted); text-transform: uppercase;
      ">${row.left}</div>
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;">
        <div style="
          font-family: var(--font-mono); font-size: 17px; letter-spacing: 0.06em;
          color: var(--color-muted); white-space: nowrap;
        ">${label}</div>
        <div data-ref="line${i}" style="
          width: 100%; height: 1.5px; background: var(--color-muted);
          transform-origin: 0 50%; transform: scaleX(0);
        "></div>
      </div>
      <div style="
        width: 240px; flex-shrink: 0; text-align: right;
        font-family: var(--font-mono); font-size: 26px; letter-spacing: 0.04em;
        color: var(--color-accent); text-transform: uppercase;
      ">${row.right}</div>
    </div>`;
}

export default defineSegment({
	id: "session-boundaries",
	advances: [45],
	voiceover:
		"The committed artifact is the interface, not the conversation. Every handoff crosses a session boundary — some fresh, some not. A model recognizes its own output distribution and defends it. Skipping the boundary produced three bookkeeping PRs in one day, fixed by /next: act where the next step is legal, stop where it is not.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "04",
			total: "15",
			x: "0480.00",
			y: "0210.00",
			unitLabel: "UNIT: SESSION · BOUNDARY",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      <div data-ref="heading" style="
        position: absolute; left: 0; top: 0; width: 100%;
        font-family: var(--font-display); font-weight: 500;
        font-size: 68px; line-height: 1.08; letter-spacing: -0.01em;
        color: var(--color-fg);
        opacity: 0;
      ">The committed artifact is the interface. <span style="color: var(--color-accent);">The conversation is not.</span></div>

      ${ROWS.map(rowHTML).join("")}

      <div data-ref="callout" style="
        position: absolute; left: 0; top: 552px; width: 100%;
        font-family: var(--font-body); font-size: 34px; line-height: 1.3;
        color: var(--color-fg);
        border-left: 3px solid var(--color-accent); padding-left: 24px;
        opacity: 0;
      ">A model recognizes its own output distribution and defends it.</div>

      <div data-ref="incident" style="
        position: absolute; left: 0; top: 656px; width: 100%;
        display: flex; align-items: flex-start; gap: 16px;
        opacity: 0;
      ">
        <div style="width: 10px; height: 10px; margin-top: 8px; background: var(--color-accent); flex-shrink: 0;"></div>
        <div data-ref="incidentLine" style="
          width: 32px; height: 1.5px; margin-top: 13px; background: var(--color-muted);
          transform-origin: 0 50%; transform: scaleX(0); flex-shrink: 0;
        "></div>
        <div style="
          font-family: var(--font-mono); font-size: 22px; line-height: 1.55;
          color: var(--color-muted); max-width: 1400px;
        ">Old shape: <span style="color: var(--color-fg);">/clean</span> always handed off to <span style="color: var(--color-fg);">/track</span>. <span style="color: var(--color-fg);">/track</span> opened a PR for its own mirror refresh. That merge put a new merge on the table. <span style="color: var(--color-accent); font-weight: 500;">3 bookkeeping PRs landed in one day.</span></div>
      </div>

      <div data-ref="closing" style="
        position: absolute; left: 0; top: 784px; width: 100%;
        opacity: 0;
      ">
        <div data-ref="closingRule" style="
          width: 100%; height: 1.5px; background: var(--color-accent); margin-bottom: 18px;
          transform-origin: 0 50%; transform: scaleX(0);
        "></div>
        <div style="
          font-family: var(--font-display); font-weight: 500; font-size: 44px; line-height: 1.15;
          color: var(--color-fg);
        ">Act where the next step is legal. Stop where it is not.</div>
        <div style="
          margin-top: 14px;
          font-family: var(--font-mono); font-size: 18px; letter-spacing: 0.08em;
          color: var(--color-muted);
        ">&mdash; fixed by /next</div>
      </div>
    `;
	},

	async play(ctx) {
		animateSceneFrame(host!);
		const opts = { fill: "forwards" as const, easing: SCENE_EASE };

		const heading = host!.querySelector('[data-ref="heading"]') as HTMLElement;
		const callout = host!.querySelector('[data-ref="callout"]') as HTMLElement;
		const incident = host!.querySelector('[data-ref="incident"]') as HTMLElement;
		const incidentLine = host!.querySelector('[data-ref="incidentLine"]') as HTMLElement;
		const closing = host!.querySelector('[data-ref="closing"]') as HTMLElement;
		const closingRule = host!.querySelector('[data-ref="closingRule"]') as HTMLElement;

		// Phase 1: heading
		heading.animate(
			[
				{ opacity: 0, transform: "translateY(14px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500, delay: 200 },
		);
		await ctx.hold(1400);

		// Phase 2: five boundary rows, staggered ~500ms apart
		ROWS.forEach((_, i) => {
			const row = host!.querySelector(`[data-ref="row${i}"]`) as HTMLElement;
			const line = host!.querySelector(`[data-ref="line${i}"]`) as HTMLElement;
			row.animate(
				[
					{ opacity: 0, transform: "translateY(10px)" },
					{ opacity: 1, transform: "translateY(0)" },
				],
				{ ...opts, duration: 400, delay: i * 500 },
			);
			line.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
				...opts,
				duration: 350,
				delay: i * 500 + 100,
			});
		});
		await ctx.hold(2900);

		// Phase 3: callout
		callout.animate(
			[
				{ opacity: 0, transform: "translateY(10px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ ...opts, duration: 500 },
		);
		await ctx.hold(1700);

		// Phase 4: incident footnote
		incident.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 400 });
		incidentLine.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
			...opts,
			duration: 300,
			delay: 100,
		});
		await ctx.hold(2300);

		// Phase 5: closing line, boxed emphasis
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
		await ctx.hold(2600);

		// Hold on full composition
		await ctx.hold(34100);
	},

	unmount() {
		host = null;
	},
});
