import type { StateDef, StatesFile, Transition } from "../entity/states";

/**
 * The counter (owner, 2026-11-28; `combat.md` §5): guard and a direction, just
 * before a blow lands, and he is gone — towards the attacker, out behind him
 * striking; away, out behind him and no more. Its states, made from each
 * fighter's own, and the window a press opens. Pure.
 */

/** Frames a press stays armed: a blow landing in them is countered. */
export const COUNTER_WINDOW = 9;
/** Frames he is gone before he comes out behind the attacker. */
const GONE = 6;
/** What each costs, in ki: a bar towards, two away. */
const COST = { counter: 10, counter_away: 20 } as const;
/** Fatigue a counter costs (`combat/fatigue.ts`), from neutral. */
export const COUNTER_FATIGUE = 15;
/** How far behind him he comes out, sprite px, where no blow of his own says. */
const BEHIND = 40;

/** The state a counter starts in: towards him, or away. */
export type CounterState = keyof typeof COST;

/** This frame's hands, as the counter reads them: guard, and the direction towards or away from him. */
export interface CounterHands {
  guardPressed: boolean;
  guardHeld: boolean;
  towards: boolean;
  away: boolean;
}

/**
 * Guard pressed with a direction held, or a direction pressed with guard held
 * (owner, 2026-11-28: guarding, a direction as the blow comes), armed for
 * `COUNTER_WINDOW` frames: the state a blow landing meanwhile sends him into,
 * or none.
 */
export class CounterWindow {
  private to: CounterState | null = null;
  private left = 0;
  private was = { towards: false, away: false };

  /** This frame's hands; nothing without one direction, or where he may not. */
  read({ guardPressed, guardHeld, towards, away }: CounterHands, may: boolean): void {
    const newly = (towards && !this.was.towards) || (away && !this.was.away);
    this.was = { towards, away };
    if (!may || towards === away || !(guardPressed || (guardHeld && newly))) return;
    this.to = towards ? "counter" : "counter_away";
    this.left = COUNTER_WINDOW;
  }

  /** One frame of the window gone; shut once it has run out. */
  tick(): void {
    if (this.left > 0 && --this.left === 0) this.to = null;
  }

  /** The counter a blow landing now meets, if armed. */
  get armed(): CounterState | null {
    return this.to;
  }

  /** Spent: a blow met it. */
  clear(): void {
    this.to = null;
    this.left = 0;
  }
}

/** Whether a body in `def` may arm a counter: on his feet or in the air, guarding or not, but in no reaction, attack or vanish. */
export function mayCounterFrom(def: StateDef | undefined): boolean {
  return !!def && (def.rank ?? 0) === 0 && !def.damage && def.type === undefined && !def.hidden && !def.invulnerable;
}

/**
 * `file` with the counter's states: gone (`counter`, `counter_away`), then
 * out behind the attacker — striking with his chase's blow, or his S1 where he
 * has none (`counter_strike`); or falling in as from a jump (`counter_behind`).
 * Gone, the attacker stands still, so the blow that comes out lands.
 */
export function withCounter(file: StatesFile): StatesFile {
  const states = file.states;
  const chase = Object.keys(states).find((n) => n.endsWith("_chase"));
  const blow = states[chase ?? "smash_1"];
  const fall = states.jump_fall;
  if (!blow || !fall) return file;
  const gone = (to: string, cost: number, stills: boolean): StateDef => ({
    anim: blow.anim,
    vel: [0, 0],
    turn: false,
    airborne: true,
    air: [[0, { vx: 0, vy: 0, gravity: 0 }]],
    damage: 0,
    hidden: true,
    invulnerable: true,
    pushless: true,
    cost,
    sound: "teleport_29",
    ...(stills && { stillsFoe: true }),
    transitions: [{ when: `frames:${GONE}`, to }],
  });
  const { transitions = [], quickens: _q, sinksAbove: _s, appears, appearsNear: _n, rises: _r, ...strike } = blow;
  const reach = appears ?? BEHIND;
  // none of the chase's ways on: a vanish asks a chase, and this is none
  const ways: Transition[] = chase ? transitions.filter((t) => !t.to.includes("_vanish")) : [{ when: "animEnd", to: "idle" }];
  return {
    ...file,
    states: {
      ...states,
      counter: gone("counter_strike", COST.counter, true),
      counter_away: gone("counter_behind", COST.counter_away, false),
      counter_strike: { ...strike, appears: reach, appearsNear: reach, appearsBehind: true, replays: true, forces: true, stillsFoe: true, transitions: ways },
      counter_behind: { ...fall, appears: reach, appearsNear: reach, appearsBehind: true, transitions: (fall.transitions ?? []).filter((t) => !t.to.includes("_vanish")) },
    },
  };
}
