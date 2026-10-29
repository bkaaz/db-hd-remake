/**
 * The ball a charging move holds in its hands — the original's `b1` effect of
 * kind 2 (docs/rom.md): not a sprite but a circle of added light, drawn at
 * whatever radius the charge has reached. Its own module because the charge
 * only drives a number; the circle is drawn by the entity.
 */

/** The original's yellow, added to what is behind: COLDATA 20, 20, 8 of 31 ($2A:A30E). */
export const BALL_COLOUR = 0xa5a542;

/** What a ball shrinks by each frame once its charge is let go ($2A:A597). */
const SHRINK = 2;

/** A state's ball: where it sits, from which frame it starts, how fast it grows. */
export interface BallDef {
  /** From the fighter's position, px, x facing-relative — `b1`'s offset. */
  at: [number, number];
  /** The state's frame it appears on, at radius 1; a later state carries it on. */
  from?: number;
  /** Radius gained each frame while a state holds it. */
  grow: number;
}

/** The radius one frame later: grown while a state holds the ball, shrunk once none does, 0 when gone. */
export function nextRadius(radius: number, def: BallDef | undefined, frame: number): number {
  if (!def) return Math.max(0, radius - SHRINK);
  if (radius === 0) return def.from !== undefined && frame >= def.from ? 1 : 0;
  return radius + def.grow;
}
