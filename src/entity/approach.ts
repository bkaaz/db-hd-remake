/**
 * A move that closes on the opponent by a share of the distance, measured
 * once — Side Slash's ($20:8400). Separate from `vel`, which is a number
 * written in the data: this speed depends on where the opponent stands.
 */

/**
 * On frame `at`: turn to face the opponent, then move at `1 / over` of the way
 * to `short` px in front of him, in whole px, until the state ends.
 */
export interface Approach {
  at: number;
  short: number;
  over: number;
}

/**
 * The forward speed, sprite px a frame, for an opponent `distance` sprite px
 * away (facing him). Whole px rounded toward zero, as the original keeps only
 * the high byte; inside `short` it backs off the same way.
 */
export function approachSpeed(approach: Approach, distance: number): number {
  return Math.trunc((Math.abs(distance) - approach.short) / approach.over);
}
