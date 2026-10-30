/**
 * Where an explosion puts its copy: the original's big ones copy themselves on
 * their second step, a random 4–11 px away on each axis, either side
 * ($0F:E1E5). Pure so the roll is testable; the effects place what it gives.
 */

/** One axis of a copy's offset, from a roll in [0, 1) and a [near, far] spread in px. */
export function copyOffset(roll: number, [near, far]: [number, number]): number {
  const span = far - near + 1;
  const distance = near + (Math.floor(roll * 2 * span) % span);
  return roll < 0.5 ? -distance : distance;
}
