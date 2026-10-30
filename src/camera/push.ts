/**
 * Who pushes the camera, and by how much ($0D:C61B) — the one decision in it
 * that is a table of cases rather than arithmetic, kept apart so it can be
 * read against the original branch by branch.
 */

/** A fighter this near the screen's edge, moving toward it, pushes the camera ($0D:C87F). */
const PUSH_BAND = 64;

/** One fighter as the camera sees it: where on the screen, and how far he moved this frame. */
export interface Mover {
  /** Screen x before this frame's move. */
  x: number;
  d: number;
}

/**
 * How far the camera moves this frame. Only a fighter in the outer band,
 * moving toward that edge, pushes it; two at the same edge push as the
 * faster; two at opposite edges as `combine` says.
 */
export function pushOf(a: Mover, b: Mover | null, screen: number): number {
  const inA = inBand(a.x, screen);
  const inB = b !== null && inBand(b.x, screen);
  if (!inA && !inB) return 0;
  const towardA = toward(a, screen);
  if (!inB) return towardA ? a.d : 0;
  const towardB = toward(b!, screen);
  if (!inA) return towardB ? b!.d : 0;
  if (rightHalf(a.x, screen) !== rightHalf(b!.x, screen)) return combine(a.d, b!.d);
  if (towardA && towardB) return combine(a.d, b!.d);
  return towardA ? a.d : towardB ? b!.d : 0;
}

function inBand(x: number, screen: number): boolean {
  return x < PUSH_BAND || x >= screen - PUSH_BAND;
}

function rightHalf(x: number, screen: number): boolean {
  return x >= screen / 2;
}

/** Moving toward the edge of the half the fighter is in; standing still counts on the right ($0D:C680). */
function toward(m: Mover, screen: number): boolean {
  return rightHalf(m.x, screen) ? m.d >= 0 : m.d < 0;
}

/** Two pushes: the larger if they go the same way, else what is left of both ($0D:C65F). */
function combine(a: number, b: number): number {
  if (a >= 0 && b >= 0) return Math.max(a, b);
  if (a < 0 && b < 0) return Math.min(a, b);
  return a + b;
}
