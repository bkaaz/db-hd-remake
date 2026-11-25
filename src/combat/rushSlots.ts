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
/**
 * A1 thrown at an opponent within his `closeRange.attack` — Goku's knee where
 * a kick would reach past him (owner, 2026-11-25). It leads on as A1 does;
 * not picked, A1 is thrown at any range.
 */
export const CLOSE = "rush_1_close";
export type Slot = (typeof RUSH)[number] | (typeof ENDERS)[number] | typeof CLOSE;
export const SLOTS: readonly Slot[] = ["rush_1", CLOSE, ...RUSH.slice(1), ...ENDERS];

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

/** The blows that step forward: Attack's whole line, A4 too, or it falls short. Every S is thrown where he stands (owner, 2026-11-25). */
const STEPS = new Set<Slot>(["rush_1", CLOSE, "rush_2", "rush_3", "rush_4"]);

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

/**
 * `file` with its rush made of `picks`: Attack walks the line, Smash leaves it
 * for the ender of that depth; Attack's blows step forward by `step`; each cancel
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
    const { cancelBy: _old, velAt: _step, ...rest } = base;
    const cancels = exits.length > 1;
    states[slot] = {
      ...rest,
      anim,
      ...((picked ?? type) !== undefined && { type: picked ?? type }),
      ...(STEPS.has(slot) && { velAt: startup === 0 ? [[0, step.hit]] : [[0, step.windup], [startup, step.hit]] }),
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
    const type = next ? "flinch" : (EFFECTS[slot] ?? states[slot]?.type);
    make(slot, states[slot] ?? states[line[i - 1]], type, exits);
    if (i === 0 && picks[CLOSE]) make(CLOSE, states[CLOSE] ?? states[slot], type, exits);
    if (ender) make(ender, states[ender] ?? states.smash, EFFECTS[ender], [{ when: "animEnd", to: "idle" }]);
  });
  closeIn(states, line.length > 0 && !!picks[CLOSE]);
  // each window from the margin of its tightest way out, with it open to the end
  const open = new Map<string, number>();
  for (const link of rushLinks({ ...file, states }, anims, baseHitstun)) {
    const by = states[link.from].cancelBy! + link.margin;
    open.set(link.from, Math.min(open.get(link.from) ?? Infinity, by));
  }
  for (const [slot, by] of open) states[slot] = { ...states[slot], cancelBy: Math.min(states[slot].cancelBy!, by) };
  return { ...file, states };
}

/**
 * The way into A1c, where Attack starts A1: the same press with the opponent
 * close, ahead of it. Taken out first, so a rush without A1c has none.
 */
function closeIn(states: Record<string, StateDef>, picked: boolean): void {
  const asksA1 = (t: Transition) => t.to === "rush_1" && [t.when].flat().join() === "pressed:attack";
  for (const [name, def] of Object.entries(states)) {
    const kept = (def.transitions ?? []).filter((t) => t.to !== CLOSE);
    if (kept.length === (def.transitions ?? []).length && !(picked && kept.some(asksA1))) continue;
    const transitions = picked ? kept.flatMap((t) => (asksA1(t) ? [{ when: ["pressed:attack", "close:attack"], to: CLOSE }, t] : [t])) : kept;
    states[name] = { ...def, transitions };
  }
}

/** The rush's links, with the sum each lives or dies by (`chainLinks`). */
export function rushLinks(file: StatesFile, anims: Record<string, AnimSteps>, baseHitstun: number): Link[] {
  const from = new Set<string>([...RUSH, CLOSE]);
  return chainLinks(withHitTypes(file), anims, baseHitstun).filter((l) => from.has(l.from));
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
