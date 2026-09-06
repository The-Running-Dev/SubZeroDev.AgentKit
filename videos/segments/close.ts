import { defineSegment } from "videowright";
import { sceneFrameHTML, animateSceneFrame, SCENE_EASE } from "../components/scene-frame";

let host: HTMLElement | null = null;

const RECAP_LINES = [
	"Artifacts, not conversation.",
	"Fresh sessions at real boundaries.",
	"Reasoning where it's expensive. Code where it's cheap.",
];

function recapHTML(line: string, i: number): string {
	const top = 60 + i * 90;
	return `
    <div data-ref="recap${i}" style="
      position: absolute; left: 0; top: ${top}px; width: 100%;
      display: flex; align-items: center; gap: 24px;
      opacity: 0;
    ">
      <div style="width: 14px; height: 14px; background: var(--color-accent); flex-shrink: 0;"></div>
      <div style="font-family: var(--font-display); font-weight: 500; font-size: 42px; color: var(--color-fg);">${line}</div>
    </div>`;
}

export default defineSegment({
	id: "close",
	advances: [20],
	voiceover:
		"Artifacts, not conversation. Fresh sessions at real boundaries. Reasoning where it's expensive, code where it's cheap. The artifact is the handoff, not the conversation.",

	mount(el) {
		host = el;
		el.innerHTML = sceneFrameHTML({
			scene: "15",
			total: "15",
			x: "0000.00",
			y: "0000.00",
			unitLabel: "UNIT: HANDOFF",
		});

		const content = el.querySelector('[data-ref="content"]') as HTMLElement;
		content.innerHTML = `
      ${RECAP_LINES.map(recapHTML).join("")}

      <div data-ref="finalBox" style="
        position: absolute; left: 0; top: 420px; width: 100%;
        padding: 48px 56px;
        border: 2px solid var(--color-accent);
        background: rgba(255, 136, 0, 0.06);
        opacity: 0;
      ">
        <div style="font-family: var(--font-display); font-weight: 500; font-size: 68px; line-height: 1.25; color: var(--color-accent); letter-spacing: -0.01em;">THE ARTIFACT IS THE HANDOFF, NOT THE CONVERSATION.</div>
      </div>

      <div data-ref="tag" style="
        position: absolute; left: 0; top: 700px; width: 100%;
        font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.15em;
        color: var(--color-muted);
        opacity: 0;
      ">AGENTKIT &middot; design/ + agent.md + .claude/commands/</div>
    `;
	},

	async play(ctx) {
		if (!host) return;
		animateSceneFrame(host);

		const opts = { fill: "forwards" as const, easing: SCENE_EASE };
		const recaps = RECAP_LINES.map(
			(_, i) => host!.querySelector(`[data-ref="recap${i}"]`) as HTMLElement,
		);
		const finalBox = host.querySelector('[data-ref="finalBox"]') as HTMLElement;
		const tag = host.querySelector('[data-ref="tag"]') as HTMLElement;

		// Three recap lines tick in, ~700ms apart (~3s)
		recaps.forEach((recap, i) => {
			recap.animate(
				[
					{ opacity: 0, transform: "translateX(-12px)" },
					{ opacity: 1, transform: "translateX(0)" },
				],
				{ ...opts, duration: 400, delay: i * 700 },
			);
		});
		await ctx.hold(3000);

		// Hold (~2s)
		await ctx.hold(2000);

		// Dim the recap lines slightly and reveal the final boxed line (~3s)
		recaps.forEach((recap) => {
			recap.animate(
				[
					{ opacity: 1, transform: "scale(1)" },
					{ opacity: 0.45, transform: "scale(0.97)" },
				],
				{ ...opts, duration: 400 },
			);
		});
		finalBox.animate(
			[
				{ opacity: 0, transform: "scaleY(0.9)" },
				{ opacity: 1, transform: "scaleY(1)" },
			],
			{ ...opts, duration: 500, delay: 150 },
		);
		await ctx.hold(3000);

		// Hold on the final line (~10s+), closing tag fades in during the last ~2s
		await ctx.hold(10000);
		tag.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 500 });
		await ctx.hold(2000);
	},

	unmount() {
		host = null;
	},
});
