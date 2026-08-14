/**
 * Bodies cannot occupy the same space.
 *
 * Unlike hit and hurt boxes, a push body is **not** per-frame: it is a fixed
 * width around the entity's anchor. Fighting games do it this way on purpose —
 * a push box that followed the animation would shove the opponent every time an
 * arm came out, and two fighters standing still would jitter.
 *
 * Sharing the correction between both bodies produces the behaviour the
 * original has for free: walk into someone and you keep advancing, at half
 * speed, while they slide back at the other half. No special case needed for
 * "who is pushing whom".
 *
 * Pure: no PixiJS, no entities — just positions on a line.
 */

export interface Body {
  /** World x of the anchor. */
  x: number;
  /** Half the body's width, in the same units as `x`. */
  half: number;
}

export interface Bounds {
  min: number;
  max: number;
}

const clamp = (x: number, b: Bounds): number => Math.max(b.min, Math.min(b.max, x));

/**
 * Move two overlapping bodies apart and return their new positions.
 *
 * The correction is split evenly, then clamped to the stage. If clamping stops
 * one of them — pinned against a wall — the other absorbs what is left, so a
 * fighter cannot be pushed through the edge of the screen.
 */
export function separate(a: Body, b: Body, bounds: Bounds): { ax: number; bx: number } {
  const needed = a.half + b.half;
  const gap = b.x - a.x;
  const overlap = needed - Math.abs(gap);
  if (overlap <= 0) return { ax: a.x, bx: b.x };

  // Exactly on top of each other: pick a side rather than dividing by zero.
  const dir = gap === 0 ? 1 : Math.sign(gap);

  let ax = clamp(a.x - (dir * overlap) / 2, bounds);
  let bx = clamp(b.x + (dir * overlap) / 2, bounds);

  // One of them may have hit a wall and not moved its share; the other takes
  // the remainder.
  const left = needed - Math.abs(bx - ax);
  if (left > 0) {
    if (ax === bounds.min || ax === bounds.max) bx = clamp(bx + dir * left, bounds);
    else ax = clamp(ax - dir * left, bounds);
  }

  return { ax, bx };
}
