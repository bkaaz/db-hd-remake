import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { COUNTER_WINDOW, CounterWindow, mayCounterFrom, withCounter } from "./counter";

describe("the counter's window", () => {
  it("arms towards or away for its frames, then shuts", () => {
    const w = new CounterWindow();
    w.press(true, false, true);
    expect(w.armed).toBe("counter");
    for (let i = 1; i < COUNTER_WINDOW; i++) w.tick();
    expect(w.armed).toBe("counter");
    w.tick();
    expect(w.armed).toBeNull();
    w.press(false, true, true);
    expect(w.armed).toBe("counter_away");
  });

  it("arms nothing without one direction, or where he may not", () => {
    const w = new CounterWindow();
    w.press(false, false, true);
    w.press(true, true, true);
    w.press(true, false, false);
    expect(w.armed).toBeNull();
  });

  it("is spent by the blow it meets", () => {
    const w = new CounterWindow();
    w.press(true, false, true);
    w.clear();
    expect(w.armed).toBeNull();
  });
});

describe("where a counter may be armed", () => {
  it("on his feet, guarding or in the air; not in a reaction, an attack or a vanish", () => {
    expect([{ anim: "a" }, { anim: "a", rank: 0 }].map((d) => mayCounterFrom(d))).toEqual([true, true]);
    expect([{ anim: "a", rank: 1 }, { anim: "a", damage: 20 }, { anim: "a", type: "flinch" }, { anim: "a", hidden: true }, { anim: "a", invulnerable: true }, undefined].map((d) => mayCounterFrom(d))).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

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
