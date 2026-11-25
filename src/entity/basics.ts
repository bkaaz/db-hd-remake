import type { Anim, Step } from "./entityFile";

/**
 * A fighter's basic blows: short blows cut out of his longer animations — an
 * ultimate's run of quick punches and kicks — each made whole by his stance
 * before and after, so a rush can stop on any of them (`combat.md`, The
 * buttons). The recipe is ours (`basics.json`); the animation is computed from
 * it by `npm run basics`, never drawn by hand.
 *
 * Pure: plain data in and out.
 */

/** Section file `basics.json`: each blow by name, cut from steps `steps[0]`–`steps[1]` of `from`. */
export type BasicsFile = Record<string, { from: string; steps: [number, number] }>;

/** A basic blow's animation is its name behind this: `b_78`. */
export const BASIC = "b_";

/** Frames of stance before the blow and after it. */
const STANCE_FRAMES = 4;
/** His stance is the pose his standing punch begins in. */
const STANCE_FROM = "m90";
/**
 * A blow landing (`hit_09`): a scene's script plays it with the blow, and puts
 * out its spark, as the blow cannot miss there; in a fight the engine does
 * both when the blow lands, so a cut blow keeps neither.
 */
const LANDING = 9;

/** Every basic blow of his, as animations named `b_<name>`; a recipe that names what is not there throws. */
export function basicAnims(recipes: BasicsFile, anims: Record<string, Anim>): Record<string, Anim> {
  const stance = anims[STANCE_FROM]?.steps[0];
  if (!stance) throw new Error(`no ${STANCE_FROM} to take his stance from`);
  const still: Step = { ...without(stance), dur: STANCE_FRAMES };
  return Object.fromEntries(
    Object.entries(recipes).map(([name, { from, steps: [first, last] }]) => {
      const source = anims[from]?.steps;
      if (!source) throw new Error(`basic "${name}": no animation ${from}`);
      if (!(first >= 0 && last >= first && last < source.length)) throw new Error(`basic "${name}": ${from} has no steps ${first}–${last}`);
      const cut = source.slice(first, last + 1).map(withoutLanding);
      return [`${BASIC}${name}`, { loop: false, steps: [still, ...cut, still] }];
    }),
  );
}

/** His animations with his basic blows made again from `recipes`: one whose recipe is gone goes too. */
export function withBasics(anims: Record<string, Anim>, recipes: BasicsFile): Record<string, Anim> {
  const drawn = Object.fromEntries(Object.entries(anims).filter(([name]) => !name.startsWith(BASIC)));
  return { ...drawn, ...basicAnims(recipes, drawn) };
}

/** A step without what its script put out for a blow sure to land: the landing's sound, the spark. */
function withoutLanding(step: Step): Step {
  const sfx = step.sfx?.filter((id) => id !== LANDING);
  const { sfx: _all, spawns: _spark, ...rest } = step;
  return sfx && sfx.length > 0 ? { ...rest, sfx } : rest;
}

/** The stance pose and its boxes alone: no sound, no voice, no hold. */
function without(step: Step): Step {
  return { frame: step.frame, dur: step.dur, ...(step.boxes && { boxes: step.boxes }) };
}
