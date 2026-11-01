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
  /** The state's frame it is gone on, at once — the effect cleared ($20:8B3C). */
  until?: number;
  /** Radius gained each frame while a state holds it. */
  grow: number;
  /** The radius it stops growing at — Saiyan Meteor's 63 ($20:8F46). */
  max?: number;
  /** In place of growing: the radius by the state's frame, round the table — Saiyan Meteor's flicker ($20:8F7D). */
  pulse?: number[];
}

/** Of a state's balls, the one up on `frame` — each holds its own stretch of frames. */
export function activeBall(defs: BallDef | BallDef[] | undefined, frame: number): BallDef | undefined {
  const list = defs === undefined ? [] : Array.isArray(defs) ? defs : [defs];
  return list.find((d) => (d.from ?? 0) <= frame && (d.until === undefined || frame < d.until));
}

/**
 * The radius one frame later: grown while a state holds the ball, shrunk once
 * none does, 0 when gone — and 0 at once between a state's own balls, as
 * the original clears the effect rather than letting it shrink.
 */
export function nextRadius(radius: number, defs: BallDef | BallDef[] | undefined, frame: number): number {
  if (defs === undefined) return Math.max(0, radius - SHRINK);
  const def = activeBall(defs, frame);
  if (!def) return 0;
  if (def.pulse) return def.pulse[frame % def.pulse.length];
  if (radius === 0) return def.from !== undefined && frame >= def.from ? 1 : 0;
  return Math.min(radius + def.grow, def.max ?? Infinity);
}
