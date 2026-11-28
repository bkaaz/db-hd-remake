import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { COUNTER_WINDOW, counterFrom, CounterWindow, withCounter, type CounterHands } from "./counter";

const hands = (h: Partial<CounterHands>): CounterHands => ({ guardPressed: false, guardHeld: false, towards: false, away: false, ...h });

describe("the counter's window", () => {
  it("arms towards or away for its frames as guard is pressed with a direction, then shuts", () => {
    const w = new CounterWindow();
    w.read(hands({ guardPressed: true, guardHeld: true, towards: true }), "neutral");
    expect(w.armed).toBe("counter");
    for (let i = 1; i < COUNTER_WINDOW.neutral; i++) w.tick();
    expect(w.armed).toBe("counter");
    w.tick();
    expect(w.armed).toBeNull();
    w.read(hands({ guardPressed: true, guardHeld: true, away: true }), "neutral");
    expect(w.armed).toBe("counter_away");
  });

  it("is shorter armed reeling, and says where it was armed from", () => {
    const w = new CounterWindow();
    w.read(hands({ guardPressed: true, towards: true }), "reaction");
    expect(w.from).toBe("reaction");
    for (let i = 1; i < COUNTER_WINDOW.reaction; i++) w.tick();
    expect(w.armed).toBe("counter");
    w.tick();
    expect(w.armed).toBeNull();
    expect(COUNTER_WINDOW.reaction).toBeLessThan(COUNTER_WINDOW.neutral);
  });

  it("arms as a direction is pressed while guard is held, not while it stays held", () => {
    const w = new CounterWindow();
    w.read(hands({ guardHeld: true }), "neutral");
    expect(w.armed).toBeNull();
    w.read(hands({ guardHeld: true, away: true }), "neutral");
    expect(w.armed).toBe("counter_away");
    w.clear();
    w.read(hands({ guardHeld: true, away: true }), "neutral");
    expect(w.armed).toBeNull();
  });

  it("arms nothing without one direction, without guard, or where he may not", () => {
    const w = new CounterWindow();
    w.read(hands({ guardPressed: true }), "neutral");
    w.read(hands({ guardPressed: true, towards: true, away: true }), "neutral");
    w.read(hands({ towards: true }), "neutral");
    w.read(hands({ guardHeld: true, away: true }), null);
    expect(w.armed).toBeNull();
  });

  it("is spent by the blow it meets", () => {
    const w = new CounterWindow();
    w.read(hands({ guardPressed: true, towards: true }), "neutral");
    w.clear();
    expect(w.armed).toBeNull();
  });
});

describe("where a counter may be armed from", () => {
  it("on his feet, guarding or in the air: neutral; not in an attack, a vanish, nor untouchable", () => {
    expect([counterFrom("idle", { anim: "a" }), counterFrom("guard", { anim: "a", rank: 0 })]).toEqual(["neutral", "neutral"]);
    expect([
      counterFrom("rush_1", { anim: "a", damage: 20 }),
      counterFrom("smash_1", { anim: "a", type: "flinch" }),
      counterFrom("smash_1_vanish", { anim: "a", hidden: true }),
      counterFrom("get_up", { anim: "a", rank: 4, invulnerable: true }),
      counterFrom("idle", undefined),
    ]).toEqual([null, null, null, null, null]);
  });

  it("reeling from a blow, but not the rush's flinch, nor lying", () => {
    expect([counterFrom("crumple", { anim: "a", rank: 1 }), counterFrom("sent_off", { anim: "a", rank: 3 }), counterFrom("juggle", { anim: "a", rank: 3 })]).toEqual(["reaction", "reaction", "reaction"]);
    expect([counterFrom("hurt_chain", { anim: "a", rank: 1 }), counterFrom("hurt_crouch", { anim: "a", rank: 1 }), counterFrom("pinned", { anim: "a", rank: 4 })]).toEqual([null, null, null]);
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
