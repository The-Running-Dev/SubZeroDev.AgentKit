/**
 * Shared Motion Engineering chrome: grid background, framed safe area with
 * corner ticks, scene counter, and a bottom coordinate readout. Segments
 * render this once in mount(), then populate the returned content slot with
 * their own absolutely-positioned elements, and call animateSceneFrame() at
 * the start of play() to bring the chrome in.
 */

export function cornerTicks(): string {
	return `
    <div style="position: absolute; left: -1px; top: -1px; width: 24px; height: 24px;">
      <div style="position: absolute; left: 0; top: 0; width: 24px; height: 1.5px; background: var(--color-accent);"></div>
      <div style="position: absolute; left: 0; top: 0; width: 1.5px; height: 24px; background: var(--color-accent);"></div>
    </div>
    <div style="position: absolute; right: -1px; top: -1px; width: 24px; height: 24px;">
      <div style="position: absolute; right: 0; top: 0; width: 24px; height: 1.5px; background: var(--color-accent);"></div>
      <div style="position: absolute; right: 0; top: 0; width: 1.5px; height: 24px; background: var(--color-accent);"></div>
    </div>
    <div style="position: absolute; left: -1px; bottom: -1px; width: 24px; height: 24px;">
      <div style="position: absolute; left: 0; bottom: 0; width: 24px; height: 1.5px; background: var(--color-accent);"></div>
      <div style="position: absolute; left: 0; bottom: 0; width: 1.5px; height: 24px; background: var(--color-accent);"></div>
    </div>
    <div style="position: absolute; right: -1px; bottom: -1px; width: 24px; height: 24px;">
      <div style="position: absolute; right: 0; bottom: 0; width: 24px; height: 1.5px; background: var(--color-accent);"></div>
      <div style="position: absolute; right: 0; bottom: 0; width: 1.5px; height: 24px; background: var(--color-accent);"></div>
    </div>`;
}

export interface SceneFrameOptions {
	/** e.g. "03" */
	scene: string;
	/** e.g. "15" */
	total: string;
	/** X coordinate shown in the bottom-left readout, e.g. "1240.00" */
	x?: string;
	/** Y coordinate shown in the bottom-left readout, e.g. "360.00" */
	y?: string;
	/** Right-aligned label in the bottom readout, e.g. "UNIT: PX · SCALE 1:1" */
	unitLabel?: string;
}

/**
 * Returns the full-height wrapper markup. Content goes inside the element
 * with `data-ref="content"`, which is absolutely positioned to the style's
 * safe area (`var(--safe-x)`/`var(--safe-y)`) and has `opacity: 0` — segments
 * animate it in themselves (or animate their own children within it) so each
 * segment controls its own choreography.
 */
export function sceneFrameHTML(opts: SceneFrameOptions): string {
	const x = opts.x ?? "0.00";
	const y = opts.y ?? "0.00";
	const unitLabel = opts.unitLabel ?? "UNIT: PX · SCALE 1:1";
	return `
    <div style="
      position: relative;
      height: 100%;
      background: var(--color-bg);
      color: var(--color-fg);
      font-family: var(--font-body);
      overflow: hidden;
    ">
      <div data-ref="grid" style="
        position: absolute; inset: 0; pointer-events: none;
        background:
          linear-gradient(var(--grid-line) 1px, transparent 1px) 0 0 / 64px 64px,
          linear-gradient(90deg, var(--grid-line) 1px, transparent 1px) 0 0 / 64px 64px;
      "></div>

      <div data-ref="frame" style="
        position: absolute;
        inset: var(--safe-y) var(--safe-x);
        border: 1px solid var(--color-border);
        opacity: 0;
      ">
        ${cornerTicks()}
        <div data-ref="content" style="position: absolute; inset: 0;"></div>
      </div>

      <div data-ref="counter" style="
        position: absolute; right: var(--safe-x); top: 28px;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--color-muted);
        letter-spacing: 0.1em;
        opacity: 0;
      ">SCENE ${opts.scene}/${opts.total}</div>

      <div data-ref="coord" style="
        position: absolute; left: var(--safe-x); right: var(--safe-x); bottom: 28px;
        display: flex; gap: 32px;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--color-muted);
        letter-spacing: 0.1em;
        opacity: 0;
      ">
        <span>X ${x}</span><span>Y ${y}</span>
        <span style="margin-left: auto;">${unitLabel}</span>
      </div>
    </div>
  `;
}

/** Standard easing for this style (cubic-bezier(0.2, 0.8, 0.2, 1) — no bounce/spring). */
export const SCENE_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Animates the frame/counter/coord chrome in. Call once at the top of
 * play(). Does not touch `data-ref="content"` — the segment animates its own
 * children there for scene-specific choreography.
 */
export function animateSceneFrame(host: HTMLElement): void {
	const frame = host.querySelector('[data-ref="frame"]') as HTMLElement;
	const counter = host.querySelector('[data-ref="counter"]') as HTMLElement;
	const coord = host.querySelector('[data-ref="coord"]') as HTMLElement;
	const opts = { fill: "forwards" as const, easing: SCENE_EASE };

	frame.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, duration: 360 });
	counter.animate([{ opacity: 0 }, { opacity: 1 }], {
		...opts,
		duration: 300,
		delay: 100,
	});
	coord.animate([{ opacity: 0 }, { opacity: 1 }], {
		...opts,
		duration: 300,
		delay: 100,
	});
}
