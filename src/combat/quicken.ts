/**
 * A chase's blow sending him on faster each time (`quickens`, owner,
 * 2026-11-26): along and never up, so he flies harder, not higher — harder
 * to get away from, and to keep up with.
 */

type Launches = Record<string, [number | null, number | null]>;

/** `launches` for the `chases`th vanish of a combo: the first as written, each after it `quickens` faster again. */
export function quickened(launches: Launches | undefined, quickens: number | undefined, chases: number): Launches | undefined {
  const by = 1 + (quickens ?? 0) * Math.max(0, chases - 1);
  if (!launches || by === 1) return launches;
  return Object.fromEntries(Object.entries(launches).map(([k, [vx, vy]]) => [k, [vx === null ? null : vx * by, vy]]));
}
