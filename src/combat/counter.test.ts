import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { withCounter } from "./counter";

describe("withCounter", () => {
  const base: StatesFile = {
    initial: "idle",
    states: {
      idle: { anim: "i", transitions: [] },
      jump_fall: { anim: "f", airborne: true, transitions: [{ when: "landed", to: "land" }] },
      smash_1: { anim: "s1", damage: 26, type: "knockback", transitions: [{ when: "animEnd", to: "idle" }] },
      smash_1_chase: { anim: "k", damage: 36, type: "sendoff", appears: 52, quickens: 0.25, airborne: true, transitions: [{ when: ["chase", "pressed:boost"], to: "smash_1_vanish" }, { when: "animEnd", to: "jump_fall" }] },
    },
  };

  it("strikes with his chase's blow out behind him, the attacker held, for a bar", () => {
    const { states } = withCounter(base);
    expect(states.counter).toMatchObject({ hidden: true, invulnerable: true, cost: 10, stillsFoe: true, transitions: [{ when: "frames:6", to: "counter_strike" }] });
    expect(states.counter_strike).toMatchObject({ anim: "k", damage: 36, type: "sendoff", appears: 52, appearsBehind: true, stillsFoe: true });
    expect(states.counter_strike.quickens).toBeUndefined();
    // no vanish off it: a chase asks one, a counter does not
    expect(states.counter_strike.transitions).toEqual([{ when: "animEnd", to: "jump_fall" }]);
  });

  it("goes behind him and no more for two bars, falling in as from a jump", () => {
    const { states } = withCounter(base);
    expect(states.counter_away).toMatchObject({ hidden: true, cost: 20, transitions: [{ when: "frames:6", to: "counter_behind" }] });
    expect(states.counter_away.stillsFoe).toBeUndefined();
    expect(states.counter_behind).toMatchObject({ anim: "f", airborne: true, appearsBehind: true, transitions: [{ when: "landed", to: "land" }] });
  });

  it("strikes with his S1 where he has no chase", () => {
    const { smash_1_chase: _, ...rest } = base.states;
    const { states } = withCounter({ ...base, states: rest });
    expect(states.counter_strike).toMatchObject({ anim: "s1", type: "knockback", appears: 40, appearsBehind: true, transitions: [{ when: "animEnd", to: "idle" }] });
  });
});
