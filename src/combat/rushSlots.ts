import type { StateDef, StatesFile, Transition } from "../entity/states";
import { chainLinks, framesOf, type Link } from "./chains";
import { withHitTypes } from "./hitTypes";
import { aimed, aimsIn, closeIn, throwIn, type Aim } from "./rushEntries";
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
/** The enders, each asked for by its direction + Smash off any depth of it (`AIMS`). */
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

/** An ender charged with what is his own: the step he stops on (`combat/smashCharge.ts`). */
export interface Charged {
  ender: string;
  stopOn?: number;
}

/** Section file `rush.json`: the rush the owner accepted, all `npm run states` needs to make it. No `step`, `DEFAULT_STEP`. */
export interface RushFile {
  picks: Picks;
  step?: Step;
  /**
   * The enders charged by holding Smash (`combat/smashCharge.ts`): Goku's first
   * (owner, 2026-11-26); one written out says what is his own.
   */
  charge?: (string | Charged)[];
}

/**
 * How each end of the rush is taken unless a pick says (owner, 2026-11-25):
 * A4 and S1 send him off, S2 floors him, S3 lifts him. A blow the line goes
 * on from is a `flinch`.
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
 * The direction that asks Smash for each ender, wherever Smash is pressed — in
 * the rush and out of it (owner, 2026-11-25; S1 forward and S2 back since
 * 2026-11-26). Smash alone in the rush is Smash alone, as standing.
 */
export const AIMS: Record<(typeof ENDERS)[number], Aim> = { smash_1: "fwd", smash_2: "back", smash_3: "down" };

/**
 * `file` with its rush made of `picks`: Attack walks the line, a direction +
 * Smash leaves it for the ender it asks for at any depth, Smash alone for
 * Smash; Attack's blows step forward by `step`; each cancel window is the
 * longest that keeps the depth's own ways on — Attack, and before A4 every
 * ender — a combo, never past its
 * animation, and open at least a frame where none can be. A slot new to the file starts as a copy of its neighbour's
 * state — rush_4 of rush_3, an ender of `smash` — for its damage and sounds.
 */
export function withRush(file: StatesFile, anims: Record<string, BlowAnim>, baseHitstun: number, picks: Picks, step: Step): StatesFile {
  const states: Record<string, StateDef> = { ...file.states };
  const gap = RUSH.findIndex((s) => !picks[s]);
  const line = gap === -1 ? [...RUSH] : RUSH.slice(0, gap);
  const enders = ENDERS.filter((e) => picks[e]);
  const make = (slot: Slot, base: StateDef, type: string | undefined, exits: Transition[]) => {
    const { anim, type: picked } = picks[slot]!;
    const startup = startupOf(anims[anim]);
    const { cancelBy: _old, velAt: _step, ...rest } = base;
    // a window only where a way out asks for one: a charge's own ways are not cancels
    const cancels = exits.some((t) => [t.when].flat().includes("cancelable"));
    states[slot] = {
      ...rest,
      anim,
      ...((picked ?? type) !== undefined && { type: picked ?? type }),
      ...(STEPS.has(slot) && { velAt: startup === 0 ? [[0, step.hit]] : [[0, step.windup], [startup, step.hit]] }),
      ...(cancels && { cancelBy: framesOf(anims[anim]) }),
      transitions: exits,
    };
  };
  // the ways on that time each window: Attack down the line, and before A4
  // each ender a direction asks for — none of them is the depth's own
  const own = new Map<string, Set<string>>();
  line.forEach((slot, i) => {
    const next = line[i + 1];
    const exits: Transition[] = [
      ...(next ? [{ when: ["cancelable", "pressed:attack"], to: next }] : []),
      ...enders.map((e) => ({ when: ["cancelable", ...aimed(AIMS[e])], to: e })),
      ...(states.smash ? [PLAIN_SMASH] : []),
      ...followUps(states[slot] ?? states[line[i - 1]]),
      { when: "animEnd", to: "idle" },
    ];
    const type = next ? "flinch" : (EFFECTS[slot] ?? states[slot]?.type);
    make(slot, states[slot] ?? states[line[i - 1]], type, exits);
    own.set(slot, new Set([next, ...(i < ENDERS.length ? enders : [])].filter((s) => s !== undefined)));
    if (i === 0 && picks[CLOSE]) {
      make(CLOSE, states[CLOSE] ?? states[slot], type, exits);
      own.set(CLOSE, own.get(slot)!);
    }
  });
  for (const e of enders) make(e, states[e] ?? blowOf(states.smash), EFFECTS[e], [...followUps(states[e]), { when: "animEnd", to: "idle" }]);
  closeIn(states, CLOSE, line.length > 0 && !!picks[CLOSE]);
  aimsIn(states, enders.map((e) => [e, AIMS[e]]), ENDERS);
  throwIn(states);
  // each window from the margin of its tightest way on, open to the end; one
  // no window makes a combo is still open a frame, to be taken all the same
  const open = new Map<string, number>();
  for (const link of rushLinks({ ...file, states }, anims, baseHitstun)) {
    if (!own.get(link.from)?.has(link.to)) continue;
    const by = Math.max(link.opens, states[link.from].cancelBy! + link.margin);
    open.set(link.from, Math.min(open.get(link.from) ?? Infinity, by));
  }
  for (const [slot, by] of open) states[slot] = { ...states[slot], cancelBy: Math.min(states[slot].cancelBy!, by) };
  return { ...file, states };
}

/**
 * What a new ender takes of `smash`: its blow — what it costs, sounds like
 * and is taken as — and nothing of how Smash alone moves, Goku's a hop
 * (owner, 2026-11-26).
 */
function blowOf(smash: StateDef | undefined): StateDef {
  const { anim = "", vel, turn, type, damage, hitSound, blockSound, hitFx } = smash ?? ({} as StateDef);
  return { anim, vel, turn, type, damage, hitSound, blockSound, hitFx, transitions: [] };
}

/**
 * A slot's own ways out of the rush — Goku's specials off any of his blows
 * (owner, 2026-11-25): the slot's, not the animation's, so they outlive a new
 * pick; a new slot takes its neighbour's. Its ways on down the line, to an
 * ender and to idle are the rush's. A special does not narrow the window,
 * which stays the combo's: it need not be one itself.
 */
function followUps(def: StateDef | undefined): Transition[] {
  return (def?.transitions ?? []).filter(isFollowUp);
}

function isFollowUp(t: Transition): boolean {
  return t.when !== "animEnd" && !(SLOTS as readonly string[]).includes(t.to) && !isPlainSmash(t);
}

/**
 * Smash alone in the rush is Smash alone, as standing: an ender is asked for
 * with its direction, at any depth (owner, 2026-11-26).
 */
const PLAIN_SMASH: Transition = { when: ["cancelable", "pressed:smash"], to: "smash" };
const isPlainSmash = (t: Transition) => t.to === PLAIN_SMASH.to && [t.when].flat().join() === [PLAIN_SMASH.when].flat().join();

/** The rush's links, slot to slot, with the sum each lives or dies by (`chainLinks`). */
export function rushLinks(file: StatesFile, anims: Record<string, AnimSteps>, baseHitstun: number): Link[] {
  const from = new Set<string>([...RUSH, CLOSE]);
  return chainLinks(withHitTypes(file), anims, baseHitstun).filter((l) => from.has(l.from) && (SLOTS as readonly string[]).includes(l.to));
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
