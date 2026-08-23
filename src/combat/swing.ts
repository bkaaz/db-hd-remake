/**
 * One swing of one attack: whether it may connect, and whether it already has.
 *
 * Those are two different facts and they used to ride on one flag. **Has it
 * connected** is what a chain cancels out of, and it stays true for the rest of
 * the move however many times the blow lands. **May it connect** is what a
 * multi-hit move needs to say no and then yes again — a beam is one sprite held
 * for half a second, and asking the animation to carry ten steps so it can hit
 * ten times would tie how often a move hits to how it is drawn. `combat.md`
 * already refused that trade once, for the active window.
 *
 * A blow with no `rehit` lands once per entry into its state, which is every
 * attack in the game today and what the field's absence means.
 *
 * Pure: no PixiJS, no clock of its own — `tick` is called by whoever owns it.
 */
export class Swing {
  /** Frames until it may connect again. `Infinity` is "not this entry". */
  private wait = 0;
  private landed = false;

  /** May this attack connect right now? */
  get canHit(): boolean {
    return this.wait <= 0;
  }

  /** Has it connected at all? What a cancel hangs off, and never withdrawn. */
  get spent(): boolean {
    return this.landed;
  }

  /**
   * It connected. `rehit` is the blow's own interval; without one this swing is
   * finished, which is the rule for every single-hit attack.
   */
  hit(rehit: number | undefined): void {
    this.landed = true;
    this.wait = rehit === undefined ? Infinity : rehit;
  }

  /**
   * One game frame.
   *
   * Not called while the entity is frozen, so the interval is counted in live
   * frames — hitstop freezes both fighters equally and must not decide how soon
   * the next hit of a multi-hit move arrives.
   */
  tick(): void {
    if (this.wait > 0) this.wait--;
  }

  /** A new state, so a new swing. */
  reset(): void {
    this.wait = 0;
    this.landed = false;
  }
}
