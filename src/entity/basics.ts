import type { Anim, Step } from "./entityFile";

/**
 * A fighter's basic blows: short blows cut out of his longer animations — an
 * ultimate's run of quick punches and kicks — each closed by his stance, so a
 * rush can stop on any of them (`combat.md`, The buttons). Not opened by it:
 * he stands in it already, and in a rush the frames before a wind-up are the
 * ones a link cannot spare (owner, 2026-11-25). The recipe is ours (`basics.json`); the animation is computed from
 * it by `npm run basics`, never drawn by hand.
 *
 * Pure: plain data in and out.
 */

/**
 * Steps `steps[0]`–`steps[1]` of `from`. `hits`, steps of `from` too, keeps
 * the hit boxes to those — `[]` to none: the others are still drawn, a knee on
 * the way to a kick, but strike nothing. `sfx` adds sounds to steps of `from`,
 * by step: a kick whose swing the string played in the part before it. `durs`
 * sets how long a step of `from` lasts: a wind-up held too long for a rush.
 */
export interface Cut {
  from: string;
  steps: [number, number];
  hits?: [number, number] | [];
  sfx?: Record<string, number[]>;
  durs?: Record<string, number>;
}

/**
 * Section file `basics.json`: each blow by name, one cut or several played in
 * turn — a kick of a string whose wind-up ends the part before it. `slow`
 * plays every step of it that many times as long.
 */
export type BasicsFile = Record<string, (Cut | { parts: Cut[] }) & { slow?: number }>;

/** A basic blow's animation is its name behind this: `b_78`. */
export const BASIC = "b_";

/** Frames of stance after the blow. */
const STANCE_FRAMES = 4;
/** His stance is the pose his standing punch begins in. */
const STANCE_FROM = "m90";
/**
 * A blow landing (`hit_09`): a scene's script plays it with the blow, and puts
 * out its spark, as the blow cannot miss there; in a fight the engine does
 * both when the blow lands, so a cut blow keeps neither.
 */
const LANDING = 9;

/**
 * Every basic blow of his, as animations named `b_<name>`; a recipe that names
 * what is not there throws. `frames` are his drawings (`frames.json`), for the
 * ones drawn where he stands (`inPlace`).
 */
export function basicAnims(recipes: BasicsFile, anims: Record<string, Anim>, frames: Record<string, unknown> = {}): Record<string, Anim> {
  const stance = anims[STANCE_FROM]?.steps[0];
  if (!stance) throw new Error(`no ${STANCE_FROM} to take his stance from`);
  const still: Step = { ...without(stance), dur: STANCE_FRAMES };
  return Object.fromEntries(
    Object.entries(recipes).map(([name, recipe]) => {
      const cuts = "parts" in recipe ? recipe.parts : [recipe];
      const steps = onceEach(cuts.flatMap((c) => cut(name, c, anims)))
        .map((st) => inPlace(st, frames))
        .map((st) => ({ ...st, dur: Math.round(st.dur * (recipe.slow ?? 1)) }));
      return [`${BASIC}${name}`, { loop: false, steps: [...steps, still] }];
    }),
  );
}

/** One cut's steps, without what a script puts out for a blow sure to land; what is not there throws. */
function cut(name: string, { from, steps: [first, last], hits = [first, last], sfx = {}, durs = {} }: Cut, anims: Record<string, Anim>): Step[] {
  const source = anims[from]?.steps;
  if (!source) throw new Error(`basic "${name}": no animation ${from}`);
  if (!(first >= 0 && last >= first && last < source.length)) throw new Error(`basic "${name}": ${from} has no steps ${first}–${last}`);
  const [firstHit, lastHit] = hits;
  if (firstHit !== undefined && !(firstHit >= first && lastHit! >= firstHit && lastHit! <= last)) throw new Error(`basic "${name}": hits ${firstHit}–${lastHit} are not among its steps ${first}–${last}`);
  const striking = (at: number) => firstHit !== undefined && at >= firstHit && at <= lastHit!;
  for (const at of [...Object.keys(sfx), ...Object.keys(durs)].map(Number)) {
    if (!(at >= first && at <= last)) throw new Error(`basic "${name}": step ${at} is not among its steps ${first}–${last}`);
  }
  return source.slice(first, last + 1).map((step, i) => {
    const added = sfx[first + i] ?? [];
    const kept = withoutLanding(striking(first + i) ? step : harmless(step));
    const timed = { ...kept, dur: durs[first + i] ?? kept.dur };
    return added.length > 0 ? { ...timed, sfx: [...(timed.sfx ?? []), ...added] } : timed;
  });
}

/** His animations with his basic blows made again from `recipes`: one whose recipe is gone goes too. */
export function withBasics(anims: Record<string, Anim>, recipes: BasicsFile, frames: Record<string, unknown>): Record<string, Anim> {
  const drawn = Object.fromEntries(Object.entries(anims).filter(([name]) => !name.startsWith(BASIC)));
  return { ...drawn, ...basicAnims(recipes, drawn, frames) };
}

/**
 * A step drawn where he stands. A string's drawing is shifted sideways as he
 * travels through it (`116_16,0`, its boxes with it); cut out and closed by his
 * stance it would jump back, and `velAt` moves him already. So the drawing
 * without the sideways shift, when he has one, and its boxes moved back.
 */
function inPlace(step: Step, frames: Record<string, unknown>): Step {
  const shifted = /^(\d+)_(-?\d+),(-?\d+)$/.exec(step.frame);
  if (!shifted || Number(shifted[2]) === 0) return step;
  const [, pose, dx, dy] = shifted;
  const plain = Number(dy) === 0 ? pose : `${pose}_0,${dy}`;
  if (!(plain in frames)) return step;
  const boxes = step.boxes?.map((b) => ({ ...b, x: b.x - Number(dx) }));
  return { ...step, frame: plain, ...(boxes && { boxes }) };
}

/** A step without what its script put out for a blow sure to land: the landing's sound, the spark. */
function withoutLanding(step: Step): Step {
  const sfx = step.sfx?.filter((id) => id !== LANDING);
  const { sfx: _all, spawns: _spark, ...rest } = step;
  return sfx && sfx.length > 0 ? { ...rest, sfx } : rest;
}

/**
 * Each sound once, where it first plays: one press, one swing. A string's
 * next swing sounds early, in the step before its kick, so a cut out of one
 * would swing twice.
 */
function onceEach(steps: Step[]): Step[] {
  const heard = new Set<number>();
  return steps.map((step) => {
    if (!step.sfx) return step;
    const sfx = step.sfx.filter((id) => !heard.has(id));
    for (const id of sfx) heard.add(id);
    const { sfx: _all, ...rest } = step;
    return sfx.length > 0 ? { ...rest, sfx } : rest;
  });
}

/** A step drawn as it is, its hit boxes gone. */
function harmless(step: Step): Step {
  const boxes = step.boxes?.filter((b) => b.type !== "hit");
  const { boxes: _all, ...rest } = step;
  return boxes && boxes.length > 0 ? { ...rest, boxes } : rest;
}

/** The stance pose and its boxes alone: no sound, no voice, no hold. */
function without(step: Step): Step {
  return { frame: step.frame, dur: step.dur, ...(step.boxes && { boxes: step.boxes }) };
}
