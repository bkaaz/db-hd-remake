/**
 * A reaction that answers a second blow its own way, whatever the blow — the
 * original's high knockdown `1e`: hit while in it, the body goes back into
 * `1e`, and from the third time into the knockdown `1b` (`$0D:D25D`, field
 * `0x7b`, cleared by any other move at `$01:8529`). Vegeta's Jumping Knee
 * Slash lands all three blows because of it.
 *
 * Separate from `ifAirborne`: that changes how a chosen reaction is taken;
 * this one overrules which reaction the blow chose. Pure.
 */

/** A reaction state's `ifHitAgain`: where a blow sends a body already in it. */
export interface IfHitAgain {
  /** The reaction again, for the first `times` blows. */
  to: string;
  times: number;
  /** After those. */
  then: string;
}

/** The reaction for the `count`-th blow taken in states with the rule, this one included. */
export function hitAgain(rule: IfHitAgain, count: number): string {
  return count <= rule.times ? rule.to : rule.then;
}

/** What is wrong with a state's `ifHitAgain`, or null. */
export function hitAgainProblem(rule: IfHitAgain, isState: (name: string) => boolean): string | null {
  if (!Number.isInteger(rule.times) || rule.times < 0) return `"ifHitAgain.times" must be a whole number, 0 or more`;
  for (const name of [rule.to, rule.then]) if (!isState(name)) return `ifHitAgain names "${name}", which is not a state`;
  return null;
}
