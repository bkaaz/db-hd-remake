/**
 * The cartridge's knockback, a state's `shove`: a push that starts at a reaction's speed and
 * loses a fixed amount every frame until it stops, so a blow shoves hard and
 * the shove dies out (`$0D:EC5F`, docs/rom.md, Hit data). A state's `vel`
 * cannot say that — it is one speed for the whole state, which is how a heavy
 * reaction slid 80 px where the original's goes 19.5.
 */

/** What a shove loses each frame, in px per frame — the cartridge's 0x40 in 8.8. */
export const PUSH_FRICTION = 0.25;

/** The shove one frame later: closer to zero by the friction, never past it. */
export function slowed(speed: number): number {
  if (speed > 0) return Math.max(0, speed - PUSH_FRICTION);
  return Math.min(0, speed + PUSH_FRICTION);
}
