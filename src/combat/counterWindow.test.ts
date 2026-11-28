import { describe, expect, it } from "vitest";
import { armFor, COUNTER_WINDOW, counterFrom, CounterWindow, type CounterArm, type CounterHands } from "./counterWindow";

const hands = (h: Partial<CounterHands>): CounterHands => ({ guardPressed: false, guardHeld: false, towards: false, away: false, ...h });
const NEUTRAL: CounterArm = { from: "neutral", window: COUNTER_WINDOW.neutral };
const REACTION: CounterArm = { from: "reaction", window: COUNTER_WINDOW.reaction };

describe("the counter's window", () => {
  it("arms towards or away for its frames as guard is pressed with a direction, then shuts", () => {
    const w = new CounterWindow();
    w.lockout = 0;
    w.read(hands({ guardPressed: true, guardHeld: true, towards: true }), NEUTRAL);
    expect(w.armed).toBe("counter");
    for (let i = 1; i < COUNTER_WINDOW.neutral; i++) w.tick();
    expect(w.armed).toBe("counter");
    w.tick();
    expect(w.armed).toBeNull();
    w.read(hands({ guardPressed: true, guardHeld: true, away: true }), NEUTRAL);
    expect(w.armed).toBe("counter_away");
  });

  it("is shorter armed reeling, and says where it was armed from", () => {
    const w = new CounterWindow();
    w.read(hands({ guardPressed: true, towards: true }), REACTION);
    expect(w.from).toBe("reaction");
    for (let i = 1; i < COUNTER_WINDOW.reaction; i++) w.tick();
    expect(w.armed).toBe("counter");
    w.tick();
    expect(w.armed).toBeNull();
    expect(COUNTER_WINDOW.reaction).toBeLessThan(COUNTER_WINDOW.neutral);
  });

  it("arms as a direction is pressed while guard is held, not while it stays held", () => {
    const w = new CounterWindow();
    w.read(hands({ guardHeld: true }), NEUTRAL);
    expect(w.armed).toBeNull();
    w.read(hands({ guardHeld: true, away: true }), NEUTRAL);
    expect(w.armed).toBe("counter_away");
    w.clear();
    w.read(hands({ guardHeld: true, away: true }), NEUTRAL);
    expect(w.armed).toBeNull();
  });

  it("arms nothing on his feet without one direction, without guard, or where he may not", () => {
    const w = new CounterWindow();
    w.read(hands({ guardPressed: true }), NEUTRAL);
    w.read(hands({ guardPressed: true, towards: true, away: true }), NEUTRAL);
    w.read(hands({ towards: true }), NEUTRAL);
    w.read(hands({ guardHeld: true, away: true }), null);
    expect(w.armed).toBeNull();
  });

  it("arms a striking counter on guard alone reeling or in an exchange, whatever the direction", () => {
    for (const arm of [REACTION, { from: "exchange", window: 6 } as CounterArm]) {
      for (const h of [{ guardPressed: true }, { guardPressed: true, away: true }]) {
        const w = new CounterWindow();
        w.read(hands(h), arm);
        expect(w.armed).toBe("counter");
      }
    }
  });

  it("is not drawn out by pressing again while armed", () => {
    const w = new CounterWindow();
    w.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
    for (let i = 1; i < COUNTER_WINDOW.neutral; i++) {
      w.tick();
      w.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
    }
    w.tick();
    expect(w.armed).toBeNull();
  });

  it("locks the next press out a while once a window ran out unmet, as long as asked, never once spent", () => {
    const w = new CounterWindow();
    w.lockout = 3;
    w.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
    for (let i = 0; i < COUNTER_WINDOW.neutral; i++) w.tick();
    expect(w.armed).toBeNull();
    // mashed: locked out
    w.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
    expect(w.armed).toBeNull();
    expect(w.armed).toBeNull();
    for (let i = 0; i < 3; i++) w.tick();
    w.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
    expect(w.armed).toBe("counter");
    // met by a blow: free at once
    w.clear();
    w.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
    expect(w.armed).toBe("counter");
    // none asked: never locked
    const free = new CounterWindow();
    free.lockout = 0;
    free.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
    for (let i = 0; i < COUNTER_WINDOW.neutral; i++) free.tick();
    free.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
    expect(free.armed).toBe("counter");
  });

  it("is spent by the blow it meets", () => {
    const w = new CounterWindow();
    w.read(hands({ guardPressed: true, towards: true }), NEUTRAL);
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

describe("an exchange of counters", () => {
  const blow = { anim: "a", damage: 30 };

  it("arms a counter of the counter where his blow was countered, shorter each time, none past the third", () => {
    expect(armFor("smash_1_chase", blow, true, 1)).toEqual({ from: "exchange", window: 6 });
    expect(armFor("counter_strike", blow, true, 2)).toEqual({ from: "exchange", window: 4 });
    expect(armFor("counter_strike", blow, true, 3)).toBeNull();
  });

  it("arms nothing in a blow countered with no counter coming, and as counterFrom says elsewhere", () => {
    expect(armFor("rush_1", blow, true, 0)).toBeNull();
    expect(armFor("rush_1", blow, false, 1)).toBeNull();
    expect(armFor("idle", { anim: "i" }, false, 0)).toEqual(NEUTRAL);
    expect(armFor("crumple", { anim: "c", rank: 1 }, false, 0)).toEqual(REACTION);
  });
});

