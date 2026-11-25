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
  private guarded = false;

  /** May this attack connect right now? */
  get canHit(): boolean {
    return this.wait <= 0;
  }

  /** Has it connected at all? What a cancel hangs off, and never withdrawn. */
  get spent(): boolean {
    return this.landed;
  }

  /** It connected on a guard — what a move that seizes on a hit must not take for one. */
  get blocked(): boolean {
    return this.guarded;
  }

  /** The blow it just landed was blocked. */
  block(): void {
    this.guarded = true;
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
    this.guarded = false;
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
 * The frames of its state, counted from 1 on entering, in which a blow may be
 * cancelled into the next: from the frame its last hit box is gone, so the
 * swing is seen whole and the next blow follows it rather than lands on top of
 * it (owner, 2026-11-24), to its `cancelBy`. A hit box drawn to the very end
 * opens it on the last frame, or it would never open. The same whether it
 * landed or missed, so a string keeps one rhythm; what punishes a miss comes
 * later. Null for an animation that cannot hit.
 */
export function cancelWindow(anim: AnimSteps | undefined, cancelBy: number | undefined): [number, number] | null {
  const end = activeEndOf(anim);
  if (end === 0) return null;
  const frames = (anim?.steps ?? []).reduce((n, s) => n + s.dur, 0);
  return [Math.min(end + 1, frames), cancelBy ?? Infinity];
}
