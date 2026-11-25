import { describe, expect, it } from "vitest";
import type { StatesFile } from "../entity/states";
import { labelOf, picksLine, picksOf, readPicks, writePicks } from "./rushAddress";

const anims = { m90: 1, m92: 1, m93: 1 };
const types = { knockback: 1, down: 1 };

describe("the picks in words", () => {
  it("names Attack's slots A1–A4 and Smash's S1–S3", () => {
    expect([labelOf("rush_1"), labelOf("rush_4"), labelOf("smash_1"), labelOf("smash_3")]).toEqual(["A1", "A4", "S1", "S3"]);
  });

  it("writes them for the address and reads them back", () => {
    const picks = { rush_1: { anim: "m90" }, rush_2: { anim: "m92" }, smash_1: { anim: "m93", type: "knockback" } };
    expect(writePicks(picks)).toBe("A1=m90,A2=m92,S1=m93:knockback");
    expect(readPicks(writePicks(picks), anims, types)).toEqual(picks);
  });

  it("says what is wrong with one: the slot, the animation, the effect", () => {
    expect(readPicks("A5=m90", anims, types)).toMatch(/no slot "A5"/);
    expect(readPicks("A1=m99", anims, types)).toMatch(/no animation m99/);
    expect(readPicks("S1=m93:fly", anims, types)).toMatch(/no hit type fly/);
  });

  it("gives the line to hand over", () => {
    expect(picksLine("goku", { rush_1: { anim: "m90" }, smash_2: { anim: "m93", type: "down" } })).toBe("goku: A1 m90, S2 m93 down");
  });
});

describe("picksOf", () => {
  it("is rush_1 and every slot a cancel of the rush leads to, nothing else", () => {
    const file: StatesFile = {
      initial: "idle",
      states: {
        rush_1: { anim: "m90", transitions: [{ when: ["cancelable", "pressed:attack"], to: "rush_2" }, { when: ["cancelable", "pressed:smash"], to: "smash_1" }] },
        rush_2: { anim: "m92", transitions: [{ when: "animEnd", to: "idle" }] },
        rush_3: { anim: "m94", transitions: [] },
        smash_1: { anim: "m93", type: "knockback", transitions: [] },
      },
    };
    expect(picksOf(file)).toEqual({ rush_1: { anim: "m90" }, rush_2: { anim: "m92" }, smash_1: { anim: "m93" } });
  });
});
