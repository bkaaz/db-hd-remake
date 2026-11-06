/**
 * The light a scene draws by frame, apart from its ball: pure, so the timing is
 * tested; `seize.ts` puts it on the screen (`b1` kinds 4 and 5, `$20:D674`, `$20:D697`).
 */

/** A dome over the floor: `grow` a frame from 1 to `max`, then `shrink` a frame until gone. */
export interface SceneDome {
  from: number;
  grow: number;
  max: number;
  shrink: number;
}

/** A bar standing on `bottom`, taller by `rise` a frame up to `tallest`; from `narrows.at` frames in, narrower by `by` each side. */
export interface SceneBar {
  from: number;
  until: number;
  /** Whose x it stands at, taken once on `from`: it does not follow him. */
  on: "seizer" | "held";
  x: [number, number];
  /** Sprite px from the floor, − up. */
  bottom: number;
  start: number;
  rise: number;
  tallest: number;
  narrows?: { at: number; by: number; least: number };
}

/** The dome's radius in sprite px on `frame`, 0 when there is none. */
export function domeRadius(dome: SceneDome, frame: number): number {
  const t = frame - dome.from;
  if (t < 0) return 0;
  const rising = Math.ceil((dome.max - 1) / dome.grow);
  if (t <= rising) return Math.min(1 + t * dome.grow, dome.max);
  return Math.max(0, dome.max - (t - rising) * dome.shrink);
}

/** The bar on `frame` in sprite px from its anchor and the floor, or null outside its frames. */
export function barAt(bar: SceneBar, frame: number): { left: number; right: number; top: number; bottom: number } | null {
  if (frame < bar.from || frame >= bar.until) return null;
  const t = frame - bar.from;
  const height = Math.min(bar.start + t * bar.rise, bar.tallest);
  const [left, right] = bar.x;
  if (!bar.narrows || t < bar.narrows.at) return { left, right, top: bar.bottom - height, bottom: bar.bottom };
  const middle = (left + right) / 2;
  const half = Math.max(bar.narrows.least, (right - left) / 2 - (t - bar.narrows.at) * bar.narrows.by);
  return { left: middle - half, right: middle + half, top: bar.bottom - height, bottom: bar.bottom };
}
