/**
 * A body bouncing off the floor, a state's `rebound`: back up at a share of
 * the speed it landed with, never slower than a floor — the knockdown's
 * bounce (`$0D:EC12`, docs/rom.md, A knockdown). A `launch` cannot say that:
 * it names one speed, and the same knockdown lands harder from higher up.
 */

export interface ReboundDef {
  /** Of the speed it landed with — the original's ¼. */
  share: number;
  /** The slowest it comes back up, px per frame — the original's 2.0. */
  min: number;
}

/** The vertical speed a body leaves the floor with, negative = up. */
export function reboundSpeed(def: ReboundDef, landedAt: number): number {
  return -Math.max(Math.abs(landedAt) * def.share, def.min);
}
