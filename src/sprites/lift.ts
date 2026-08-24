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
  /** Overrides the anchor mode for this frame alone. */
  anchor?: AnchorAt;
}

/** Where it ended up, in our frame format. */
export interface LiftedFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: [number, number];
}

/** The anchor point a mode asks for, in the frame's own pixels. */
function anchorFor(at: AnchorAt, r: SrcRect): [number, number] {
  const midX = Math.round((r.w - 1) / 2);
  const midY = Math.round((r.h - 1) / 2);
  if (at === "centre") return [midX, midY];
  return [0, at === "back" ? midY : r.h - 1];
}

/**
 * Where a lifted frame's anchor goes.
 *
 * `centre` suits anything that happens *at* a point — a burst, a flash — and
 * keeps a growing effect from crawling sideways as its frames change size.
 * `back` puts it on the middle of the frame's rear edge, which is what a thing
 * **emitted** from somewhere needs: the anchor is then the muzzle, so the
 * drawing starts at the hand and grows forward instead of straddling it.
 * `back-bottom` is the same idea for something emitted **diagonally**: the rear
 * of a climbing shot is its lower-back corner, and anchoring it at the middle
 * of the edge hangs half the drawing below the hand that threw it.
 */
export type AnchorAt = "centre" | "back" | "back-bottom";

/**
 * Copy the rects into a new sheet, laid out in one row.
 *
 * A frame keeps its own anchor rather than sharing one with its neighbours,
 * because these frames differ in size and each has to sit right on its own.
 */
export function liftFrames(
  src: Rgba,
  rects: readonly SrcRect[],
  { gap = 1, anchor = "centre" }: { gap?: number; anchor?: AnchorAt } = {},
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
      anchor: anchorFor(r.anchor ?? anchor, r),
    });
    ox += r.w + gap;
  }

  return { sheet: { width, height, data }, frames };
}
