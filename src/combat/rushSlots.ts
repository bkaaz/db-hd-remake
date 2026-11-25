import type { StateDef, StatesFile } from "../entity/states";
import { chainLinks, framesOf, type Link } from "./chains";
import { withHitTypes } from "./hitTypes";
import { startupOf, type AnimSteps } from "./swing";

/**
 * A fighter's rush built from three animations, one a slot — what the debug
 * panel tries live and what the data of an accepted rush is (`combat.md`, The
 * buttons). Everything but the choice is computed: the step forward from each
 * blow's wind-up, the cancel window as the longest that is still a combo.
 *
 * Pure: plain data in and out.
 */

/** The slots, in the order Attack walks them. */
export const SLOTS = ["rush_1", "rush_2", "rush_3"] as const;
export type Picks = readonly [string, string, string];

/** An animation as the rush reads it: its poses too, to tell a whole blow. */
export interface BlowAnim extends AnimSteps {
  loop?: boolean;
  steps: (AnimSteps["steps"][number] & { frame: string })[];
}

/** Px a frame forward: through the wind-up, then from the frame the hit box is out. */
export interface Step {
  windup: number;
  hit: number;
}

const pose = (step: { frame: string }): string => step.frame.split("_")[0];
const hits = (step: AnimSteps["steps"][number]): boolean => (step.boxes ?? []).some((b) => b.type === "hit");

/**
 * The animations a slot may hold: every one that hits. Whether it is a whole
 * blow — one a fighter can stop on, since he cannot know another press is
 * coming — is the owner's to see: a blow ending in its own pose is no test,
 * the original's often end on a recovery pose of their own. Of animations
 * drawn alike, the one a state plays, else the first by name; the one-frame
 * steps of an object's parts are no fighter's blow.
 */
export function candidates(anims: Record<string, BlowAnim>, played: ReadonlySet<string>): string[] {
  const kept = new Map<string, string>();
  for (const name of Object.keys(anims).sort()) {
    const { loop, steps } = anims[name];
    if (loop || !steps.some(hits) || steps.every((s) => s.dur === 1)) continue;
    const drawn = JSON.stringify(steps.map((s) => [pose(s), s.dur, hits(s)]));
    const before = kept.get(drawn);
    if (before === undefined || (!played.has(before) && played.has(name))) kept.set(drawn, name);
  }
  return [...kept.values()].sort();
}

/**
 * `file` with its rush made of `picks`: rush_1 and rush_2 a `flinch`, each
 * cancelled by Attack into the next; each blow stepping forward by `step`; each
 * cancel window the longest that is still a combo, never past its animation.
 */
export function withRush(file: StatesFile, anims: Record<string, BlowAnim>, baseHitstun: number, picks: Picks, step: Step): StatesFile {
  const states: Record<string, StateDef> = { ...file.states };
  SLOTS.forEach((slot, i) => {
    const anim = anims[picks[i]];
    const startup = startupOf(anim);
    const next = SLOTS[i + 1];
    states[slot] = {
      ...states[slot],
      anim: picks[i],
      velAt: startup === 0 ? [[0, step.hit]] : [[0, step.windup], [startup, step.hit]],
      ...(next ? { type: "flinch", cancelBy: framesOf(anim) } : { cancelBy: undefined }),
      transitions: [...(next ? [{ when: ["cancelable", "pressed:attack"], to: next }] : []), { when: "animEnd", to: "idle" }],
    };
  });
  // the window from the margin each link has with it open to the end
  const open = { ...file, states };
  for (const link of rushLinks(open, anims, baseHitstun)) {
    const def = states[link.from];
    states[link.from] = { ...def, cancelBy: Math.min(def.cancelBy!, def.cancelBy! + link.margin) };
  }
  return { ...file, states: Object.fromEntries(Object.entries(states).map(([n, d]) => [n, d.cancelBy === undefined ? without(d) : d])) };
}

/** The rush's links, with the sum each lives or dies by (`chainLinks`). */
export function rushLinks(file: StatesFile, anims: Record<string, AnimSteps>, baseHitstun: number): Link[] {
  return chainLinks(withHitTypes(file), anims, baseHitstun).filter((l) => (SLOTS as readonly string[]).includes(l.from));
}

/**
 * How fast a rush steps where its fighter says nothing: Goku's as the owner
 * accepted it, half the Quad Kick's (2026-11-24).
 */
export const DEFAULT_STEP: Step = { windup: 1.1875, hit: 0.625 };

/** The step his rush_1 takes now, or the default for a fighter whose does not step. */
export function stepOf(file: StatesFile): Step {
  const velAt = file.states.rush_1?.velAt;
  if (!velAt || velAt.length === 0) return DEFAULT_STEP;
  return { windup: velAt[0][1], hit: velAt[velAt.length - 1][1] };
}

/** What each slot holds now. */
export function picksOf(file: StatesFile): Picks {
  const [a, b, c] = SLOTS.map((s) => file.states[s]?.anim ?? "");
  return [a, b, c];
}

/** `m90,m92,m94` — the picks as an address carries them — or why not. */
export function readPicks(text: string, anims: Record<string, unknown>): Picks | string {
  const names = text.split(",");
  if (names.length !== SLOTS.length) return `rush "${text}" is not three animations`;
  const missing = names.filter((n) => !(n in anims));
  if (missing.length > 0) return `rush: no animation ${missing.join(", ")}`;
  const [a, b, c] = names;
  return [a, b, c];
}

/** The line the panel offers to copy, naming what each slot holds. */
export function picksLine(fighter: string, picks: Picks): string {
  return `${fighter}: ${picks.map((p, i) => `A${i + 1} ${p}`).join(", ")}`;
}

function without(def: StateDef): StateDef {
  const { cancelBy: _gone, ...rest } = def;
  return rest;
}
