/**
 * The combo being done **to** one fighter: how many blows have landed since
 * they last had control of themselves, and what those blows cost.
 *
 * It lives on the defender rather than the attacker because that is where the
 * question is asked. "How long have I been helpless" is a fact about the body
 * taking the beating, and it stays true if the attacker is replaced mid-combo,
 * or if the blows come from a projectile nobody is holding.
 *
 * **Control is rank 0.** A reaction has a rank — flinch, stagger, knockdown,
 * on the floor — and everything else has none. So "recovered" needs no separate
 * signal and no timer: entering any state that is not a reaction *is* the reset,
 * which means the counter cannot drift out of step with what the fighter is
 * actually doing.
 *
 * Nothing reads it yet beyond the debug readout. It is here now because the
 * three scalings of `docs/combat.md` §3 — damage, hitstun and launch — all hang
 * off this one number, and a counter invented twice is a counter that disagrees
 * with itself.
 *
 * Pure: no PixiJS, no entities, no clock.
 */
export class Combo {
  private count = 0;
  private total = 0;

  /** Blows landed since the fighter last had control. */
  get hits(): number {
    return this.count;
  }

  /** What those blows have cost in health. */
  get damage(): number {
    return this.total;
  }

  /** A blow landed on this fighter. Blocked blows are not combo hits. */
  hit(damage: number): void {
    this.count++;
    this.total += damage;
  }

  /**
   * The fighter entered a state of this severity. Rank 0 is anything that is
   * not a reaction — standing, walking, attacking — and means they are theirs
   * again, so the combo is over.
   */
  enter(rank: number): void {
    if (rank === 0) {
      this.count = 0;
      this.total = 0;
    }
  }
}
