/**
 * Where a vanish comes out (owner, 2026-11-26/27). Past the opponent the way
 * he goes, `reach.past` from him, a gap he flies into; off a wall, between it
 * and him instead, so he is sent across and not back into it, `reach.near`
 * from him, as he flies off from there. The arena's edge may bring him
 * closer, never nearer than `reach.near`; where not even that fits, the near
 * side, the blow driving him into the wall. Pure.
 */

/**
 * Where he stands and which way he faces (1 right, −1 left) coming out after
 * an opponent at `foe.x`. The side is the wall he met (`foe.wall`), else
 * the way he goes (his last frame's move), else away from `fromX`, else
 * `facing`.
 */
export function appearAt(
  fromX: number,
  foe: { x: number; goes?: number; wall?: number },
  reach: { past: number; near: number },
  bounds: { min: number; max: number },
  facing: 1 | -1,
): { x: number; facing: 1 | -1 } {
  const away = foe.wall || foe.goes || Math.sign(foe.x - fromX) || facing;
  // `past` leaves a gap he flies into; behind his flight he flies off from it, so the blow's middle on him
  const far = foe.goes && foe.goes !== away ? reach.near : reach.past;
  // between him and the wall wherever he fits there, the blow still on him: not a rally off the wall
  const room = away > 0 ? bounds.max - foe.x : foe.x - bounds.min;
  if (room >= reach.near) return { x: foe.x + away * Math.min(far, room), facing: away > 0 ? -1 : 1 };
  return { x: foe.x - away * reach.near, facing: away > 0 ? 1 : -1 };
}
