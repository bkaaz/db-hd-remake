/**
 * The intro screen's fixed colour, added to what is drawn in OBJ palettes 4–7
 * there (`$2131`): a blue that grows down the screen, the gradient Gotenks's
 * intro stands in. Ours plays the intro on the arena, so an object in those
 * palettes is drawn with it baked in, by the screen row it would stand on —
 * his discharges (`gotenks_discharge`), solid where ours had them added to
 * the arena (bugs.md, 2026-11-07).
 */

import type { Drawing } from "./frame";

/** The screen row a fighter's feet stand on there (`sy` 200, tools/re/runs/gotenks-intro.json). */
const FEET_ROW = 200;

/**
 * The gradient's blue on a screen row, of 31: from row 130 one more every 3
 * rows, from 175 every 2, 31 at 205 (measured on that run's frame 645).
 */
export function introBlue(row: number): number {
  if (row < 130) return 0;
  if (row < 175) return 1 + Math.floor((row - 130) / 3);
  return Math.min(31, 16 + Math.floor((row - 175) / 2));
}

/** The drawing with the gradient added to every pixel, as it would stand with its origin on the feet's row. */
export function withIntroLight(d: Drawing): Drawing {
  const { width, height } = d.image;
  const data = new Uint8Array(d.image.data);
  for (let y = 0; y < height; y++) {
    const blue = introBlue(FEET_ROW + y - d.origin.y) << 3;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] !== 0) data[i + 2] = Math.min(248, data[i + 2] + blue);
    }
  }
  return { image: { width, height, data }, origin: d.origin };
}
