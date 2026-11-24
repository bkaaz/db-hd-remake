/**
 * Fatigue: the original's stun gauge (field `0x68`) counted the other way, so
 * the HUD's line grows with it. Blows taken add their cartridge's stun; past
 * the full amount the fighter is spent and it starts again from nothing
 * ($0D:D5E7). It does not wear off: the original's point every 16 frames
 * ($0D:D78A) is left out, at the owner's call. What being spent does is the
 * entity's, not this.
 */

/** How much he can take: twice the original's 20, so it fills half as fast (owner, 2026-11-24). */
export const FATIGUE_MAX = 40;

export class Fatigue {
  private level = 0;

  /** Add a blow's worth; true when it went past the full amount, and it empties. */
  take(amount: number): boolean {
    this.level += amount;
    if (this.level <= FATIGUE_MAX) return false;
    this.level = 0;
    return true;
  }

  /** How full, 0..1 — what the HUD's line draws. */
  get fraction(): number {
    return this.level / FATIGUE_MAX;
  }
}
