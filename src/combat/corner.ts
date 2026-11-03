import type { Bounds } from "./push";

/**
 * A shove into the screen's edge passes to the other fighter, reversed, for
 * what it had left ($0D:C8F0): the one pinned against the edge stops, and
 * whoever hit him slides back instead — so the corner cannot be held by
 * hitting. Pure: positions, facings and shoves only.
 *
 * Not passed while the shoved one has no health, nor from the moves in
 * `$0D:CA35`'s bit table: the standing reels `11`–`16`, `29`–`32` and `7e`.
 * The original's other condition, field `0x25` bit 2, is not read `?`.
 */

/** `$0D:CA35`: the moves whose shove stays with them at the edge. */
const KEPT = new Set([0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32, 0x7e]);

export interface Shoved {
  x: number;
  facing: 1 | -1;
  /** Facing-relative px a frame, as a state's `shove` (− back). */
  shove: number;
  /** The cartridge's move its state plays, or null for one that is not a cartridge's. */
  move: number | null;
  health: number;
}

/**
 * The shove `other` takes from `shoved` this frame, facing-relative for
 * `other` — or null when `shoved` keeps it. The edge is the screen's, 16 px
 * in (`screen`): past it going left, or at it going right, as the original
 * tests x < camera + 17 and x ≥ camera + 240.
 */
export function passedShove(shoved: Shoved, other: { facing: 1 | -1 }, screen: Bounds): number | null {
  if (shoved.shove === 0 || shoved.health <= 0) return null;
  if (shoved.move !== null && KEPT.has(shoved.move)) return null;
  const toward = shoved.facing * shoved.shove;
  const atEdge = toward < 0 ? shoved.x <= screen.min : shoved.x >= screen.max;
  if (!atEdge) return null;
  // the same speed the other way across the world, in the other's own facing
  return -toward * other.facing;
}

/** The cartridge's move an animation plays — `m13_2` is `0x13` — or null for any other name. */
export function moveOf(anim: string): number | null {
  const m = /^m([0-9a-f]{2})(_|$)/.exec(anim);
  return m ? parseInt(m[1], 16) : null;
}
