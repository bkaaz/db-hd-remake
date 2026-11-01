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

/**
 * From frame `from`, `speed` px a frame straight at the opponent until within
 * `stop`, then set down exactly `stop` px short of him on this side —
 * Saiyan Meteor's unseen rush ($20:89E1). Its direction is the world's, not
 * the facing's.
 */
export interface Rush {
  from: number;
  speed: number;
  stop: number;
}

/**
 * One frame of a rush, for an opponent `distance` sprite px away (+ to the
 * right): how far to move, + to the right, and whether this is the arrival.
 * The original's two sides differ by a pixel — from the left it stops at 40,
 * from the right only under 40 (`CMP #$FFD8` / `CMP #$0028`) — and so do these.
 */
export function rushStep(rush: Rush, distance: number): { dx: number; arrived: boolean } {
  const arrived = distance > 0 ? distance <= rush.stop : -distance < rush.stop;
  if (!arrived) return { dx: Math.sign(distance) * rush.speed, arrived };
  // set down `stop` short, on the side it came from
  return { dx: distance - Math.sign(distance) * rush.stop, arrived };
}
