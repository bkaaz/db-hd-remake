/**
 * Where a chase's blow sends him (owner, 2026-11-26): faster along with each
 * chase after the first (`quickens`) — harder to get away from — and down,
 * not up, once he flies higher than the attacker's own jump reaches
 * (`sinks`), so a chase keeps to a jump's height however high it began (S3's).
 */

type Launches = Record<string, [number | null, number | null]>;

/**
 * The share of its rise a sinking launch sends him down by: nearly flat, the
 * flight's gravity bending it down — as steep as the rise, gravity on top of
 * it made it fall like a stone (owner, 2026-11-26).
 */
const SINK = 0.2;

export interface ChaseFlight {
  quickens?: number;
  sinks?: boolean;
}

/**
 * `launches` for the `chases`th vanish of a combo, the opponent `above` px
 * over the floor and the attacker's jump reaching `peak`.
 */
export function chaseLaunch(launches: Launches | undefined, { quickens, sinks }: ChaseFlight, chases: number, above: number, peak: number): Launches | undefined {
  const by = 1 + (quickens ?? 0) * Math.max(0, chases - 1);
  const down = sinks === true && above > peak;
  if (!launches || (by === 1 && !down)) return launches;
  return Object.fromEntries(
    Object.entries(launches).map(([k, [vx, vy]]) => [k, [vx === null ? null : vx * by, vy === null || !down ? vy : Math.abs(vy) * SINK]]),
  );
}

/** Sprite px a jump off `vy` (up, negative) rises at `gravity` a frame: its peak. */
export function jumpPeak(vy: number, gravity: number): number {
  return gravity > 0 ? (vy * vy) / (2 * gravity) : 0;
}
