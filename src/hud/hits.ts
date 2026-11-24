/**
 * What the hit counter shows: a combo from its second hit, and the last one it
 * showed for a second after it ends — the combo itself is gone the moment the
 * victim is his own again (`combat/combo.ts`). Kept apart from the drawing so
 * the timing can be tested.
 */

export interface Shown {
  hits: number;
  damage: number;
}

/** A combo is shown from this many hits. */
export const FROM_HITS = 2;
/** Frames it stays after the combo ends. */
export const HOLD = 60;

export class HitCounter {
  private last: Shown | null = null;
  private left = 0;

  /** One game frame, with the combo as it stands: the hits landed and what they cost. */
  tick(hits: number, damage: number): void {
    if (hits >= FROM_HITS) {
      this.last = { hits, damage };
      this.left = HOLD;
    } else if (this.left > 0) this.left--;
    else this.last = null;
  }

  get shown(): Shown | null {
    return this.last;
  }
}
