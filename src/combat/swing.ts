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

/** The little of an animation a swing's timing needs: step lengths, and which steps hit. */
export interface AnimSteps {
  steps: { dur: number; boxes?: { type: string }[] }[];
}

const hits = (step: AnimSteps["steps"][number]): boolean => (step.boxes ?? []).some((b) => b.type === "hit");

/** Frames before the hit box appears. */
export function startupOf(anim: AnimSteps | undefined): number {
  let before = 0;
  for (const step of anim?.steps ?? []) {
    if (hits(step)) return before;
    before += step.dur;
  }
  return before;
}

/** Frames until the last hit box is gone — when a swing that has not connected has missed. */
export function activeEndOf(anim: AnimSteps | undefined): number {
  let total = 0;
  let end = 0;
  for (const step of anim?.steps ?? []) {
    total += step.dur;
    if (hits(step)) end = total;
  }
  return end;
}

/**
 * The frames of its state, counted from 1 on entering, in which a swing that
 * **missed** may be cancelled into the next blow (owner, 2026-09-29, an
 * experiment — what punishes it comes later). It opens once the last hit box
 * is gone and lasts as long as a hit's window does, so a string keeps the same
 * rhythm whether it lands or not; `cancelBy` itself stays tuned for the hit.
 * Null for an animation that cannot hit, and so cannot miss.
 */
export function missWindow(anim: AnimSteps | undefined, cancelBy: number | undefined): [number, number] | null {
  const end = activeEndOf(anim);
  if (end === 0) return null;
  return [end + 1, cancelBy === undefined ? Infinity : end + cancelBy - startupOf(anim)];
}
