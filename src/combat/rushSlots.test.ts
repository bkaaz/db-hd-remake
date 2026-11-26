import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { framesOf } from "./chains";
import { HIT_TYPES } from "./hitTypes";
import { DEFAULT_STEP, rushLinks, stepOf, withRush, type BlowAnim, type Picks } from "./rushSlots";

const hit = { type: "hit" };
/** Wind-up, hit box, recovery, in that pose order: frames 70 → 71 → 70. */
const blow = (windup: number, active: number, recovery: number, last = "70"): BlowAnim => ({
  steps: [
    { frame: "70", dur: windup },
    { frame: "71", dur: active, boxes: [hit] },
    { frame: last, dur: recovery },
  ],
});

describe("withRush", () => {
  const anims: Record<string, BlowAnim> = { a: blow(6, 6, 6), b: blow(4, 8, 10), c: blow(10, 12, 16), quick: blow(0, 4, 4), s: blow(6, 6, 12) };
  const file: StatesFile = {
    initial: "idle",
    states: {
      idle: { anim: "a", transitions: [] },
      ...Object.fromEntries(["hurt_chain", "reel_heavy", "blown", "reel_down", "launched"].map((r) => [r, { anim: "a", vel: [-1, 0] as [number, number], transitions: [] }])),
      rush_1: { anim: "x", type: "light", damage: 20, transitions: [{ when: "animEnd", to: "idle" }] },
      rush_2: { anim: "x", type: "light", damage: 20, transitions: [{ when: "animEnd", to: "idle" }] },
      rush_3: { anim: "x", type: "heavy", damage: 25, transitions: [{ when: "animEnd", to: "idle" }] },
      smash: { anim: "x", type: "heavy", damage: 29, transitions: [{ when: "animEnd", to: "idle" }] },
    },
  };
  const step = { windup: 2, hit: 1 };
  const three: Picks = { rush_1: { anim: "a" }, rush_2: { anim: "b" }, rush_3: { anim: "c" } };
  const made = withRush(file, anims, 14, three, step);
  const exits = (f: StatesFile, s: string) => (f.states[s].transitions ?? []).map((t) => `${[t.when].flat().join("+")}>${t.to}`);

  it("puts each pick in its slot and walks Attack from one to the next", () => {
    expect(["rush_1", "rush_2", "rush_3"].map((s) => made.states[s].anim)).toEqual(["a", "b", "c"]);
    expect(exits(made, "rush_1")).toEqual(["cancelable+pressed:attack>rush_2", "cancelable+pressed:smash>smash", "animEnd>idle"]);
    expect(exits(made, "rush_3")).toEqual(["cancelable+pressed:smash>smash", "animEnd>idle"]);
  });

  it("makes a blow the line goes on from a flinch, and leaves the last its own blow", () => {
    expect([made.states.rush_1.type, made.states.rush_2.type, made.states.rush_3.type]).toEqual(["flinch", "flinch", "heavy"]);
  });

  it("stops Attack's line at the first slot not picked", () => {
    const gap = withRush(file, anims, 14, { rush_1: { anim: "a" }, rush_3: { anim: "c" } }, step);
    expect(exits(gap, "rush_1")).toEqual(["cancelable+pressed:smash>smash", "animEnd>idle"]);
  });

  it("steps forward faster through the wind-up, slower from the hit box", () => {
    expect(made.states.rush_1.velAt).toEqual([[0, 2], [6, 1]]);
    const noWindup = withRush(file, anims, 14, { ...three, rush_1: { anim: "quick" } }, step);
    expect(noWindup.states.rush_1.velAt).toEqual([[0, 1]]);
  });

  describe("a slot's own way out, a special", () => {
    const wave = { when: ["cancelable", "held:fwd", "pressed:blast"], to: "kame" };
    const own = { ...made, states: { ...made.states, rush_1: { ...made.states.rush_1, transitions: [wave, ...made.states.rush_1.transitions!] } } };
    const again = withRush(own, anims, 14, { ...three, rush_1: { anim: "b" }, rush_1_close: { anim: "quick" } }, step);

    it("stays through a new pick, after the rush's ways on, and A1c leads there too", () => {
      expect(exits(again, "rush_1")).toEqual(["cancelable+pressed:attack>rush_2", "cancelable+pressed:smash>smash", "cancelable+held:fwd+pressed:blast>kame", "animEnd>idle"]);
      expect(exits(again, "rush_1_close")).toEqual(exits(again, "rush_1"));
    });

    it("leaves the window the combo's: a special is no link of the rush", () => {
      expect(again.states.rush_1.cancelBy).toBe(withRush(file, anims, 14, { ...three, rush_1: { anim: "b" } }, step).states.rush_1.cancelBy);
      expect(rushLinks(again, anims, 14).map((l) => l.to)).not.toContain("kame");
    });
  });

  describe("A1 thrown close", () => {
    const standing = { ...file, states: { ...file.states, idle: { anim: "a", transitions: [{ when: "pressed:attack", to: "rush_1" }] } } };
    const close = withRush(standing, anims, 14, { ...three, rush_1_close: { anim: "quick" } }, step);

    it("is asked for by the same press with the opponent close, ahead of A1", () => {
      expect(exits(close, "idle")).toEqual(["pressed:attack+close:attack>rush_1_close", "pressed:attack>rush_1"]);
    });

    it("leads on as A1 does, a flinch with its own window", () => {
      expect(exits(close, "rush_1_close")).toEqual(exits(close, "rush_1"));
      expect(close.states.rush_1_close.type).toBe("flinch");
      expect(rushLinks(close, anims, 14).filter((l) => l.from === "rush_1_close" && !(l.margin >= 0))).toEqual([]);
    });

    it("is gone, the way in too, when it is not picked", () => {
      const again = withRush(close, anims, 14, three, step);
      expect(exits(again, "idle")).toEqual(["pressed:attack>rush_1"]);
    });
  });

  describe("A4 and the enders", () => {
    const deep = withRush(file, anims, 14, { ...three, rush_4: { anim: "a" }, smash_1: { anim: "s" }, smash_2: { anim: "s" }, smash_3: { anim: "s" } }, step);

    it("makes A4 out of rush_3's state, rush_3 then a flinch the line goes on from", () => {
      expect(deep.states.rush_4).toMatchObject({ anim: "a", damage: 25 });
      expect(deep.states.rush_3.type).toBe("flinch");
    });

    it("leaves each depth for the ender a direction asks for, any of them, and Smash alone for Smash, an ender made out of smash", () => {
      expect(exits(deep, "rush_2")).toEqual([
        "cancelable+pressed:attack>rush_3",
        "cancelable+held:fwd+!held:down+!held:up+pressed:smash>smash_1",
        "cancelable+held:back+!held:down+!held:up+pressed:smash>smash_2",
        "cancelable+held:down+!held:fwd+!held:back+pressed:smash>smash_3",
        "cancelable+pressed:smash>smash",
        "animEnd>idle",
      ]);
      expect(deep.states.smash_2).toMatchObject({ anim: "s", damage: 29 });
      expect(exits(deep, "smash_2")).toEqual(["animEnd>idle"]);
    });

    it("takes the ends as the rule says: A4 and S1 send him off, S2 floors him, S3 lifts him", () => {
      expect(["rush_4", "smash_1", "smash_2", "smash_3"].map((s) => deep.states[s].type)).toEqual(["knockback", "knockback", "down", "launch"]);
    });

    it("throws every S where he stands, and steps A4 forward with the line, or it falls short", () => {
      expect(["smash_1", "smash_2", "smash_3"].map((s) => deep.states[s].velAt)).toEqual([undefined, undefined, undefined]);
      expect(deep.states.rush_4.velAt).toBeDefined();
    });

    it("keeps an ender's own way out through a new pick, cancelable to the end of its animation", () => {
      const up = { when: ["cancelable", "held:back", "pressed:blast"], to: "kame_up" };
      const withUp = { ...deep, states: { ...deep.states, smash_3: { ...deep.states.smash_3, transitions: [up, ...deep.states.smash_3.transitions!] } } };
      const again = withRush(withUp, anims, 14, { ...three, smash_3: { anim: "a" } }, step);
      expect(exits(again, "smash_3")).toEqual(["cancelable+held:back+pressed:blast>kame_up", "animEnd>idle"]);
      expect(again.states.smash_3.cancelBy).toBe(framesOf(anims.a));
    });

    it("takes a picked effect over the rule's", () => {
      const picked = withRush(file, anims, 14, { ...three, smash_1: { anim: "s", type: "trip" } }, step);
      expect(picked.states.smash_1.type).toBe("trip");
    });

    it("keeps a depth's own ways on a combo: one window, the tightest of them", () => {
      const own = (l: { from: string; to: string }) => l.to === `smash_${l.from.slice(-1)}` || l.to === `rush_${Number(l.from.slice(-1)) + 1}`;
      expect(rushLinks(deep, anims, 14).filter((l) => own(l) && !(l.margin >= 0))).toEqual([]);
    });

    it("lets a direction + Smash in the rush be taken where it cannot be a combo, the window still the depth's own", () => {
      // A4 has no ender of its own, so no window narrows for one
      expect(exits(deep, "rush_4").filter((e) => e.includes(">smash_"))).toHaveLength(3);
      expect(deep.states.rush_4.cancelBy).toBe(framesOf(anims.a));
    });

    it("never closes a window before it opens, so a link that cannot be a combo is still taken", () => {
      const late = { ...anims, slow: blow(40, 6, 6) };
      const made = withRush(file, late, 14, { rush_1: { anim: "a" }, smash_1: { anim: "slow" } }, step);
      const [link] = rushLinks(made, late, 14);
      expect(link.margin).toBeLessThan(0);
      expect(link.opens).toBeLessThanOrEqual(link.closes);
    });
  });

  it("gives each cancel the longest window that is still a combo, never past its animation", () => {
    const links = rushLinks(made, anims, 14);
    expect(links.map((l) => l.margin >= 0)).toEqual([true, true]);
    for (const l of links) {
      const by = made.states[l.from].cancelBy!;
      expect(l.margin === 0 || by === framesOf(anims[made.states[l.from].anim])).toBe(true);
    }
    // the line's last: no way on to time, Smash alone open to its end
    expect(made.states.rush_3.cancelBy).toBe(framesOf(anims.c));
  });

  it("says when a link cannot be a combo however it is cancelled", () => {
    // a flinch's hitstun cannot cover a recovery this long before the next hit
    expect(HIT_TYPES.flinch.hitstun).toBeLessThan(60);
    const slow = { ...anims, long: blow(2, 60, 4) };
    const links = rushLinks(withRush(file, slow, 14, { ...three, rush_1: { anim: "long" } }, step), slow, 14);
    expect(links[0].opens > links[0].closes || links[0].margin < 0).toBe(true);
  });
});

describe("stepOf", () => {
  it("is how fast his rush_1 steps, or the default for one that does not", () => {
    const file = (velAt?: [number, number][]): StatesFile => ({ initial: "idle", states: { rush_1: { anim: "a", velAt, transitions: [] } } });
    expect(stepOf(file([[0, 2], [6, 1]]))).toEqual({ windup: 2, hit: 1 });
    expect(stepOf(file())).toEqual(DEFAULT_STEP);
  });
});
