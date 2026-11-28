import type { StateDef, StatesFile, Transition } from "../entity/states";

/**
 * The counter's states (owner, 2026-11-28; `combat.md` §5), made from each
 * fighter's own: he is gone, then out behind the attacker — striking, or no
 * more. What arms one is `counterWindow.ts`. Pure.
 */

/** Frames he is gone before he comes out behind the attacker. */
const GONE = 6;
/** What each costs, in ki: a bar towards, two away. */
const COST = { counter: 10, counter_away: 20 } as const;
/** How far behind him he comes out, sprite px, where no blow of his own says. */
const BEHIND = 40;

/** The state a counter starts in: towards him, or away. */
export type CounterState = keyof typeof COST;

/** Whether `name` is one of the counter's states: gone in it, or out of it. */
export const isCounter = (name: string): boolean => name === "counter" || name === "counter_away" || name === "counter_strike" || name === "counter_behind";

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
