import type { StateDef, StatesFile, Transition } from "../entity/states";
import { chainLinks, framesOf, type Link } from "./chains";
import { withHitTypes } from "./hitTypes";
import { startupOf, type AnimSteps } from "./swing";

/**
 * A fighter's rush built from picks, one animation a slot — what the debug
 * panel tries live and what the data of an accepted rush is (`combat.md`, The
 * buttons). Everything but the choice is computed: the step forward from each
 * blow's wind-up, the cancel window as the longest that is still a combo.
 *
 * Pure: plain data in and out.
 */

/** Attack's line, in the order it walks it. */
export const RUSH = ["rush_1", "rush_2", "rush_3", "rush_4"] as const;
/** Smash off each depth of it: smash_1 off rush_1, and so on. */
export const ENDERS = ["smash_1", "smash_2", "smash_3"] as const;
export type Slot = (typeof RUSH)[number] | (typeof ENDERS)[number];
export const SLOTS: readonly Slot[] = [...RUSH, ...ENDERS];

/** What a slot plays, and how its blow is taken; no `type`, the slot's own. */
export interface Pick {
  anim: string;
  type?: string;
}
/** A slot not picked is not in the rush: Attack's line stops at its first gap. */
export type Picks = Partial<Record<Slot, Pick>>;

/**
 * How each end of the rush is taken unless a pick says (owner, 2026-11-25):
 * the deeper, the better the end — A4 and S1 send him off, S2 floors him, S3
 * lifts him. A blow the line goes on from is a `flinch`.
 */
export const EFFECTS: Partial<Record<Slot, string>> = { rush_4: "knockback", smash_1: "knockback", smash_2: "down", smash_3: "launch" };

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
 * `file` with its rush made of `picks`: Attack walks the line, Smash leaves it
 * for the ender of that depth; each blow steps forward by `step`; each cancel
 * window is the longest that keeps every way out of it a combo, never past
 * its animation. A slot new to the file starts as a copy of its neighbour's
 * state — rush_4 of rush_3, an ender of `smash` — for its damage and sounds.
 */
export function withRush(file: StatesFile, anims: Record<string, BlowAnim>, baseHitstun: number, picks: Picks, step: Step): StatesFile {
  const states: Record<string, StateDef> = { ...file.states };
  const gap = RUSH.findIndex((s) => !picks[s]);
  const line = gap === -1 ? [...RUSH] : RUSH.slice(0, gap);
  const make = (slot: Slot, base: StateDef, type: string | undefined, exits: Transition[]) => {
    const { anim, type: picked } = picks[slot]!;
    const startup = startupOf(anims[anim]);
    const { cancelBy: _old, ...rest } = base;
    const cancels = exits.length > 1;
    states[slot] = {
      ...rest,
      anim,
      ...((picked ?? type) !== undefined && { type: picked ?? type }),
      velAt: startup === 0 ? [[0, step.hit]] : [[0, step.windup], [startup, step.hit]],
      ...(cancels && { cancelBy: framesOf(anims[anim]) }),
      transitions: exits,
    };
  };
  line.forEach((slot, i) => {
    const next = line[i + 1];
    const ender = ENDERS[i] && picks[ENDERS[i]] ? ENDERS[i] : undefined;
    const exits: Transition[] = [
      ...(next ? [{ when: ["cancelable", "pressed:attack"], to: next }] : []),
      ...(ender ? [{ when: ["cancelable", "pressed:smash"], to: ender }] : []),
      { when: "animEnd", to: "idle" },
    ];
    make(slot, states[slot] ?? states[line[i - 1]], next ? "flinch" : (EFFECTS[slot] ?? states[slot]?.type), exits);
    if (ender) make(ender, states[ender] ?? states.smash, EFFECTS[ender], [{ when: "animEnd", to: "idle" }]);
  });
  // each window from the margin of its tightest way out, with it open to the end
  const open = new Map<string, number>();
  for (const link of rushLinks({ ...file, states }, anims, baseHitstun)) {
    const by = states[link.from].cancelBy! + link.margin;
    open.set(link.from, Math.min(open.get(link.from) ?? Infinity, by));
  }
  for (const [slot, by] of open) states[slot] = { ...states[slot], cancelBy: Math.min(states[slot].cancelBy!, by) };
  return { ...file, states };
}

/** The rush's links, with the sum each lives or dies by (`chainLinks`). */
export function rushLinks(file: StatesFile, anims: Record<string, AnimSteps>, baseHitstun: number): Link[] {
  return chainLinks(withHitTypes(file), anims, baseHitstun).filter((l) => (RUSH as readonly string[]).includes(l.from));
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
