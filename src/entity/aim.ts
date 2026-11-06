/**
 * A shot that closes on the opponent's height, as Gotenks's ghosts do
 * (`$0F:CC45`): it keeps its forward speed and only its vy answers, so it
 * chases a jump but never turns back. Separate from `approach.ts`, which moves
 * a body along the ground.
 */

/** From frame `from` of its state: `speed` px a frame toward `above` px over his feet, still within `within`. */
export interface Aim {
  from: number;
  above: number;
  within: number;
  speed: number;
  /** It only looks every so many frames of its own, keeping its vy between: `$74 & 3`, so it overshoots by a little. Every frame if absent. */
  every?: number;
}

/** Whether a shot `frame` frames old looks at the opponent's height this frame (1 is the frame it is put out). */
export function aimsOn(aim: Aim, frame: number): boolean {
  return frame >= aim.from && (aim.every === undefined || (frame - 1) % aim.every === 0);
}

/** The vy for a shot `height` px under the opponent's feet (− above them). */
export function aimSpeed(aim: Aim, height: number): number {
  const off = height + aim.above;
  if (Math.abs(off) < aim.within) return 0;
  return off < 0 ? aim.speed : -aim.speed;
}
