/**
 * Fatigue: a gauge of 100 counted toward a collapse. Every hit counts the same
 * — a blow, a throw, a scene's last blow — and a blocked one does not count
 * (owner, 2026-11-24): simpler than the original's stun gauge (field `0x68`),
 * where each blow takes its own amount and the gauge refills by itself. Points
 * rather than hits so a counter can cost its own (owner, 2026-11-28). What
 * being spent does is the entity's (`onTired`), not this.
 */

/** The gauge full: he is spent. */
export const FATIGUE_FULL = 100;
/** What a hit taken adds: twenty spend him. */
export const PER_HIT = 5;

export class Fatigue {
  private points = 0;

  /** One more hit; true when it is the one that spends him, and the gauge starts again. */
  hit(): boolean {
    return this.add(PER_HIT);
  }

  /** `points` more; true when the gauge is full, and it starts again from nothing. */
  add(points: number): boolean {
    this.points += points;
    if (this.points < FATIGUE_FULL) return false;
    this.points = 0;
    return true;
  }

  /** How full, 0..1 — what the HUD's line draws. */
  get fraction(): number {
    return this.points / FATIGUE_FULL;
  }
}
