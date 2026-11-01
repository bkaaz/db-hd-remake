/**
 * An effect a state leaves on the floor at a beat while it plays — the dust
 * Double Punch raises as it slides ($20:8727). Separate from `groundFx`,
 * which is one puff on entering: a beat is a second rule, not a variant of it.
 */

/** Every `every` frames of the state, from `from` to `to` (inclusive), `fx` under the entity. */
export interface Trail {
  fx: string;
  every: number;
  from?: number;
  to?: number;
}

/**
 * Whether the trail puts one out on this frame of the state. The original
 * counts the game's frames (`$74 & 3`), not the move's, so its first puff can
 * come up to `every − 1` frames from ours; how many there are and how far
 * apart is the same.
 */
export function trailAt(trail: Trail | undefined, frame: number): boolean {
  if (!trail) return false;
  const from = trail.from ?? 0;
  if (frame < from || (trail.to !== undefined && frame > trail.to)) return false;
  return (frame - from) % trail.every === 0;
}
