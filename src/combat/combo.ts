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
/**
 * How many times one fighter may be lifted **again** in a single combo.
 *
 * Two, on top of the blow that opened the combo: a launcher starts it, one more
 * keeps it going and one more ends it, and the next cannot start it over. It
 * lives here rather than in an entity's attributes because it is a rule of the
 * fight, not a property of a body: a juggle limit one fighter could opt out of
 * is not a limit.
 */
export const SMASH_LIMIT = 2;

export class Combo {
  private count = 0;
  private total = 0;
  private smashes = 0;
  /** Severity of the state the fighter is in — 0 while they have control. */
  private rank = 0;

  /** Blows landed since the fighter last had control. */
  get hits(): number {
    return this.count;
  }

  /** What those blows have cost in health. */
  get damage(): number {
    return this.total;
  }

  /** Times this fighter has been lifted *again* since they last had control. */
  get lifts(): number {
    return this.smashes;
  }

  /**
   * Whether another blow may still lift or floor this fighter in this combo.
   *
   * The hard limit scaling cannot give: a fourth uppercut can be made weak by a
   * curve, never impossible, and an uppercut that relaunches a body it already
   * knocked down loops forever. Past the limit such a blow still hits and still
   * hurts — it simply does not lift, so the victim keeps falling on the arc
   * they were already on and the exchange ends itself.
   *
   * **Only a *re*-launch is limited.** A blow landing on somebody who has
   * control of themselves is how a combo starts, and refusing that would mean
   * the opener could be eaten by a budget it had no part in spending. Rank 0 is
   * exactly "this fighter is their own", which is the same fact the reset uses.
   */
  get smashable(): boolean {
    return this.rank === 0 || this.smashes < SMASH_LIMIT;
  }

  /** A blow landed on this fighter. Blocked blows are not combo hits. */
  hit(damage: number): void {
    this.count++;
    this.total += damage;
  }

  /**
   * A blow lifted or floored this fighter. Spends from the budget only when it
   * was a *re*-launch — one landing on a fighter who was already helpless.
   *
   * Called before the reaction is entered, so the rank it reads is the state
   * the blow arrived in. Counted only when the reaction was actually entered
   * either: one that rank refused changed nothing, so it has no business
   * spending anything.
   */
  smash(): void {
    if (this.rank > 0) this.smashes++;
  }

  /**
   * The fighter entered a state of this severity. Rank 0 is anything that is
   * not a reaction — standing, walking, attacking — and means they are theirs
   * again, so the combo is over.
   */
  enter(rank: number): void {
    this.rank = rank;
    if (rank === 0) {
      this.count = 0;
      this.total = 0;
      this.smashes = 0;
    }
  }
}
