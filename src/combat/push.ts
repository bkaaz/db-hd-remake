/**
 * Bodies cannot occupy the same space.
 *
 * A cartridge fighter pushes with his drawing's own body and head (`push`
 * boxes, read from the original's slots 0 and 1): two rectangles in the
 * plane, so a jump into a jumping opponent meets him and a jump over a
 * standing one is pushed aside. A hand-built one has no such boxes and keeps
 * a fixed width around the anchor, solid only on the ground — the one-number
 * body below.
 *
 * Sharing the correction between both bodies produces the behaviour the
 * original has for free: walk into someone and you keep advancing, at half
 * speed, while they slide back at the other half. No special case needed for
 * "who is pushing whom".
 *
 * Pure: no PixiJS, no entities — just positions and rectangles.
 */

import { overlaps, type WorldRect } from "./hit";

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
 * Move two overlapping one-number bodies apart and return their new positions.
 *
 * The correction is split evenly, then clamped to the stage. If clamping stops
 * one of them — pinned against a wall — the other absorbs what is left, so a
 * fighter cannot be pushed through the edge of the screen.
 */
export function separate(a: Body, b: Body, bounds: Bounds): { ax: number; bx: number } {
  return pushApart(a.x, b.x, a.half + b.half - Math.abs(b.x - a.x), bounds);
}

/**
 * How far two fighters' push boxes overlap along x, or 0 when none touch.
 * The first pair that touches decides, in the original's order ($2A:89D0):
 * body against body, head against head, then each against the other's.
 */
export function bodyOverlap(a: readonly WorldRect[], b: readonly WorldRect[], aIsLeft: boolean): number {
  const pairs: [WorldRect | undefined, WorldRect | undefined][] = [[a[0], b[0]], [a[1], b[1]], [a[0], b[1]], [a[1], b[0]]];
  for (const [p, q] of pairs) {
    if (!p || !q || !overlaps(p, q)) continue;
    return aIsLeft ? p.x + p.w - q.x : q.x + q.w - p.x;
  }
  return 0;
}

/** Move two bodies `overlap` apart along x, half each, `a` away from `b`. */
export function pushApart(ax0: number, bx0: number, overlap: number, bounds: Bounds): { ax: number; bx: number } {
  if (overlap <= 0) return { ax: ax0, bx: bx0 };
  const gap = bx0 - ax0;
  const needed = Math.abs(gap) + overlap;

  // Exactly on top of each other: pick a side rather than dividing by zero.
  const dir = gap === 0 ? 1 : Math.sign(gap);

  let ax = clamp(ax0 - (dir * overlap) / 2, bounds);
  let bx = clamp(bx0 + (dir * overlap) / 2, bounds);

  // One of them may have hit a wall and not moved its share; the other takes
  // the remainder.
  const left = needed - Math.abs(bx - ax);
  if (left > 0) {
    if (ax === bounds.min || ax === bounds.max) bx = clamp(bx + dir * left, bounds);
    else ax = clamp(ax - dir * left, bounds);
  }

  return { ax, bx };
}
