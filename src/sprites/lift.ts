import type { Rgba } from "./png";

/**
 * Copying frames out of one sheet into a sheet of their own.
 *
 * A projectile and its burst are separate entities from the fighter who fires
 * them — they move on their own and outlive his animation — but their art was
 * drawn on his sheet. This lifts those pixels into a spawn's own image.
 *
 * **The source is never modified.** `goku.png` is hand-extended and matches no
 * public rip, so re-flowing it would strand every rect in `frames.json`.
 *
 * Pure: no filesystem. `scripts/lift.ts` reads and writes the files.
 */

/** Where a frame sits in the source sheet. */
export interface SrcRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where it ended up, in our frame format. */
export interface LiftedFrame extends SrcRect {
  anchor: [number, number];
}

/**
 * Copy the rects into a new sheet, laid out in one row.
 *
 * The anchor is each frame's own centre, which is what a thing in flight turns
 * and mirrors around — unlike a fighter, who is anchored at his feet. Frames
 * differ in size (a burst tears itself apart as it goes), so centring each one
 * individually is what keeps the effect from crawling sideways as it plays.
 */
export function liftFrames(
  src: Rgba,
  rects: readonly SrcRect[],
  gap = 1,
): { sheet: Rgba; frames: LiftedFrame[] } {
  if (rects.length === 0) throw new Error("nothing to lift");
  for (const r of rects) {
    if (r.w <= 0 || r.h <= 0) throw new Error(`empty rect ${JSON.stringify(r)}`);
    if (r.x < 0 || r.y < 0 || r.x + r.w > src.width || r.y + r.h > src.height) {
      throw new Error(`rect ${JSON.stringify(r)} is outside the ${src.width}x${src.height} sheet`);
    }
  }

  const width = rects.reduce((sum, r) => sum + r.w + gap, gap);
  const height = Math.max(...rects.map((r) => r.h)) + 2 * gap;
  const data = new Uint8Array(width * height * 4);
  const frames: LiftedFrame[] = [];

  let ox = gap;
  for (const r of rects) {
    for (let y = 0; y < r.h; y++) {
      const from = ((r.y + y) * src.width + r.x) * 4;
      const to = ((gap + y) * width + ox) * 4;
      data.set(src.data.subarray(from, from + r.w * 4), to);
    }
    frames.push({
      x: ox,
      y: gap,
      w: r.w,
      h: r.h,
      anchor: [Math.round((r.w - 1) / 2), Math.round((r.h - 1) / 2)],
    });
    ox += r.w + gap;
  }

  return { sheet: { width, height, data }, frames };
}
