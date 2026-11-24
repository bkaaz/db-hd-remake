/**
 * Fatigue: hits taken, counted toward a collapse. Every hit counts the same —
 * a blow, a throw, a scene's last blow — and a blocked one does not count
 * (owner, 2026-11-24): simpler than the original's stun gauge (field `0x68`),
 * where each blow takes its own amount and the gauge refills by itself. What
 * being spent does is the entity's (`onTired`), not this.
 */

/** Hits until he is spent. */
export const FATIGUE_HITS = 20;

export class Fatigue {
  private hits = 0;

  /** One more hit; true when it is the one that spends him, and the count starts again. */
  hit(): boolean {
    if (++this.hits < FATIGUE_HITS) return false;
    this.hits = 0;
    return true;
  }

  /** How full, 0..1 — what the HUD's line draws. */
  get fraction(): number {
    return this.hits / FATIGUE_HITS;
  }
}
