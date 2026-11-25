import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { framesOf } from "./chains";
import { HIT_TYPES } from "./hitTypes";
import { candidates, DEFAULT_STEP, picksLine, picksOf, readPicks, rushLinks, stepOf, withRush, type BlowAnim } from "./rushSlots";

const hit = { type: "hit" };
/** Wind-up, hit box, recovery, in that pose order: frames 70 → 71 → 70. */
const blow = (windup: number, active: number, recovery: number, last = "70"): BlowAnim => ({
  steps: [
    { frame: "70", dur: windup },
    { frame: "71", dur: active, boxes: [hit] },
    { frame: last, dur: recovery },
  ],
});

describe("candidates", () => {
  it("takes every blow that hits, however it ends — that is the owner's to see", () => {
    expect(candidates({ punch: blow(4, 4, 6), cut: blow(4, 4, 6, "88") }, new Set())).toEqual(["cut", "punch"]);
  });

  it("leaves out what cannot hit, a loop, and an object's one-frame steps", () => {
    const still: BlowAnim = { steps: [{ frame: "70", dur: 4 }, { frame: "70", dur: 4 }] };
    const looped: BlowAnim = { ...blow(4, 4, 6), loop: true };
    const object: BlowAnim = { steps: [{ frame: "70", dur: 1, boxes: [hit] }, { frame: "70", dur: 1 }] };
    expect(candidates({ still, looped, object }, new Set())).toEqual([]);
  });

  it("keeps one of animations drawn alike: the one a state plays, else the first by name", () => {
    expect(candidates({ m85: blow(4, 4, 6), m90: blow(4, 4, 6) }, new Set(["m90"]))).toEqual(["m90"]);
    expect(candidates({ m85: blow(4, 4, 6), m90: blow(4, 4, 6) }, new Set())).toEqual(["m85"]);
  });
});

describe("withRush", () => {
  const anims: Record<string, BlowAnim> = { a: blow(6, 6, 6), b: blow(4, 8, 10), c: blow(10, 12, 16), quick: blow(0, 4, 4) };
  const file: StatesFile = {
    initial: "idle",
    states: {
      idle: { anim: "a", transitions: [] },
      hurt_chain: { anim: "a", vel: [-1, 0], transitions: [] },
      reel_heavy: { anim: "a", vel: [-1, 0], transitions: [] },
      rush_1: { anim: "x", type: "light", damage: 20, transitions: [{ when: "animEnd", to: "idle" }] },
      rush_2: { anim: "x", type: "light", damage: 20, transitions: [{ when: "animEnd", to: "idle" }] },
      rush_3: { anim: "x", type: "heavy", damage: 25, transitions: [{ when: "animEnd", to: "idle" }] },
    },
  };
  const made = withRush(file, anims, 14, ["a", "b", "c"], { windup: 2, hit: 1 });

  it("puts each pick in its slot and walks Attack from one to the next", () => {
    expect(["rush_1", "rush_2", "rush_3"].map((s) => made.states[s].anim)).toEqual(["a", "b", "c"]);
    expect(made.states.rush_1.transitions?.[0]).toEqual({ when: ["cancelable", "pressed:attack"], to: "rush_2" });
    expect(made.states.rush_3.transitions).toEqual([{ when: "animEnd", to: "idle" }]);
  });

  it("makes the first two a flinch and leaves the last its own blow", () => {
    expect([made.states.rush_1.type, made.states.rush_2.type, made.states.rush_3.type]).toEqual(["flinch", "flinch", "heavy"]);
  });

  it("steps forward faster through the wind-up, slower from the hit box", () => {
    expect(made.states.rush_1.velAt).toEqual([[0, 2], [6, 1]]);
    const noWindup = withRush(file, anims, 14, ["quick", "b", "c"], { windup: 2, hit: 1 });
    expect(noWindup.states.rush_1.velAt).toEqual([[0, 1]]);
  });

  it("gives each cancel the longest window that is still a combo, never past its animation", () => {
    const links = rushLinks(made, anims, 14);
    expect(links.map((l) => l.margin >= 0)).toEqual([true, true]);
    for (const l of links) {
      const by = made.states[l.from].cancelBy!;
      expect(l.margin === 0 || by === framesOf(anims[made.states[l.from].anim])).toBe(true);
    }
    expect(made.states.rush_3.cancelBy).toBeUndefined();
  });

  it("says when a link cannot be a combo however it is cancelled", () => {
    // a flinch's hitstun cannot cover a recovery this long before the next hit
    expect(HIT_TYPES.flinch.hitstun).toBeLessThan(60);
    const slow = { ...anims, long: blow(2, 60, 4) };
    const links = rushLinks(withRush(file, slow, 14, ["long", "b", "c"], { windup: 2, hit: 1 }), slow, 14);
    expect(links[0].opens > links[0].closes || links[0].margin < 0).toBe(true);
  });
});

describe("picksLine", () => {
  it("names each slot's animation, for the owner to hand over", () => {
    expect(picksLine("goku", ["m92", "m93_short", "m90"])).toBe("goku: A1 m92, A2 m93_short, A3 m90");
  });
});

describe("reading the picks back", () => {
  const file: StatesFile = {
    initial: "idle",
    states: {
      idle: { anim: "m00", transitions: [] },
      rush_1: { anim: "a", velAt: [[0, 2], [6, 1]], transitions: [] },
      rush_2: { anim: "b", transitions: [] },
      rush_3: { anim: "c", transitions: [] },
    },
  };

  it("names what each slot plays now, and how fast the rush steps", () => {
    expect(picksOf(file)).toEqual(["a", "b", "c"]);
    expect(stepOf(file)).toEqual({ windup: 2, hit: 1 });
    expect(stepOf({ ...file, states: { ...file.states, rush_1: { anim: "a", transitions: [] } } })).toEqual(DEFAULT_STEP);
  });

  it("takes three animations from an address, and says which it lacks", () => {
    expect(readPicks("a,b,c", { a: 1, b: 1, c: 1 })).toEqual(["a", "b", "c"]);
    expect(readPicks("a,b", { a: 1, b: 1 })).toMatch(/not three/);
    expect(readPicks("a,b,z", { a: 1, b: 1 })).toMatch(/no animation z/);
  });
});
