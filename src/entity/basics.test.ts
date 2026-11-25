import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generatedFighters } from "../rom/fighterStates";
import { basicAnims, withBasics, type BasicsFile } from "./basics";
import type { Anim } from "./entityFile";

const hit = { type: "hit" as const, x: 20, y: -50, w: 20, h: 10 };
const anims: Record<string, Anim> = {
  m90: { loop: false, steps: [{ frame: "70", dur: 6, sfx: [6] }, { frame: "71", dur: 6, boxes: [hit] }] },
  mae: {
    loop: false,
    steps: [
      { frame: "77", dur: 4, boxes: [hit] },
      { frame: "78", dur: 6, boxes: [hit], sfx: [7, 9], spawns: [{ name: "hit_spark", at: [40, -42] }] },
      { frame: "79", dur: 5 },
    ],
  },
};

describe("basicAnims", () => {
  const made = basicAnims({ jab: { from: "mae", steps: [0, 1] } }, anims);

  it("cuts the steps asked for and closes them with his stance, named b_<name>", () => {
    expect(made.b_jab.steps.map((s) => [s.frame, s.dur])).toEqual([["77", 4], ["78", 6], ["70", 4]]);
  });

  it("opens straight on the cut: he stands in his stance already, and a link cannot spare the frames", () => {
    expect(made.b_jab.steps[0].frame).toBe("77");
  });

  it("keeps the swing and leaves the landing to the engine, which plays it when the blow lands", () => {
    expect(made.b_jab.steps.map((s) => s.sfx)).toEqual([undefined, [7], undefined]);
  });

  it("puts out no spark of its own: the engine draws one where a blow lands", () => {
    expect(made.b_jab.steps.some((s) => s.spawns)).toBe(false);
  });

  it("keeps the hit boxes of the steps it cuts", () => {
    expect(made.b_jab.steps[0].boxes).toEqual([hit]);
  });

  it("keeps the hit boxes to the steps `hits` names, the rest still drawn", () => {
    const kick = basicAnims({ kick: { from: "mae", steps: [0, 2], hits: [1, 1] } }, anims).b_kick;
    expect(kick.steps.map((s) => [s.frame, (s.boxes ?? []).some((b) => b.type === "hit")])).toEqual([
      ["77", false],
      ["78", true],
      ["79", false],
      ["70", false],
    ]);
    expect(() => basicAnims({ x: { from: "mae", steps: [0, 1], hits: [2, 2] } }, anims)).toThrow(/not among its steps/);
    const none = basicAnims({ knee: { from: "mae", steps: [0, 1], hits: [] } }, anims).b_knee;
    expect(none.steps.some((s) => (s.boxes ?? []).some((b) => b.type === "hit"))).toBe(false);
  });

  it("plays several cuts in turn, each from its own animation: a wind-up that ends the part before", () => {
    const twoPart = basicAnims({ kick: { parts: [{ from: "mae", steps: [2, 2] }, { from: "m90", steps: [1, 1] }] } }, anims).b_kick;
    expect(twoPart.steps.map((s) => s.frame)).toEqual(["79", "71", "70"]);
  });

  it("swings once: a sound heard twice in the cut plays only the first time", () => {
    const twice: Record<string, Anim> = { ...anims, two: { loop: false, steps: [{ frame: "88", dur: 4, sfx: [7] }, { frame: "89", dur: 4, boxes: [hit], sfx: [7] }] } };
    expect(basicAnims({ kick: { from: "two", steps: [0, 1] } }, twice).b_kick.steps.map((s) => s.sfx)).toEqual([[7], undefined, undefined]);
  });

  it("adds a sound to a step it names, a step of the cut", () => {
    const loud = basicAnims({ kick: { from: "mae", steps: [0, 1], sfx: { "0": [7] } } }, anims).b_kick;
    expect(loud.steps.map((s) => s.sfx)).toEqual([[7], undefined, undefined]);
    expect(() => basicAnims({ kick: { from: "mae", steps: [0, 1], sfx: { "2": [7] } } }, anims)).toThrow(/not among its steps/);
  });

  it("plays every step of a slow one that many times as long, the stance after it as ever", () => {
    const slow = basicAnims({ kick: { from: "mae", steps: [0, 1], slow: 1.5 } }, anims).b_kick;
    expect(slow.steps.map((s) => s.dur)).toEqual([6, 9, 4]);
  });

  it("draws a step where he stands: the sideways shift a string travels by gone, its boxes moved back", () => {
    const shifted: Record<string, Anim> = { ...anims, run: { loop: false, steps: [{ frame: "116_16,0", dur: 6, boxes: [{ ...hit, x: 36 }] }, { frame: "119_0,-8", dur: 4 }] } };
    const kick = basicAnims({ kick: { from: "run", steps: [0, 1] } }, shifted, { "116": {}, "116_16,0": {}, "119_0,-8": {} }).b_kick;
    expect(kick.steps.map((s) => s.frame)).toEqual(["116", "119_0,-8", "70"]);
    expect(kick.steps[0].boxes?.[0].x).toBe(20);
    // without the plain drawing there is nothing to put him back on
    expect(basicAnims({ kick: { from: "run", steps: [0, 0] } }, shifted, {}).b_kick.steps[0].frame).toBe("116_16,0");
  });

  it("holds a step as long as `durs` says", () => {
    expect(basicAnims({ kick: { from: "mae", steps: [0, 1], durs: { "0": 2 } } }, anims).b_kick.steps.map((s) => s.dur)).toEqual([2, 6, 4]);
  });

  it("refuses an animation or steps that are not there", () => {
    expect(() => basicAnims({ x: { from: "nope", steps: [0, 0] } }, anims)).toThrow(/no animation nope/);
    expect(() => basicAnims({ x: { from: "mae", steps: [1, 5] } }, anims)).toThrow(/no steps 1–5/);
  });
});

describe("withBasics", () => {
  it("makes them again, and drops one whose recipe is gone", () => {
    const before = withBasics(anims, { jab: { from: "mae", steps: [0, 1] } }, {});
    const after = withBasics(before, { kick: { from: "mae", steps: [2, 2] } }, {});
    expect(Object.keys(after).sort()).toEqual(["b_kick", "m90", "mae"]);
  });
});

describe.each(generatedFighters().filter((n) => existsSync(`data/entities/${n}/basics.json`)))("%s's basic blows on disk", (name) => {
  it("are what his basics.json makes — npm run basics", () => {
    const onDisk = JSON.parse(readFileSync(`data/entities/${name}/animations.json`, "utf8")) as Record<string, Anim>;
    const recipes = JSON.parse(readFileSync(`data/entities/${name}/basics.json`, "utf8")) as BasicsFile;
    const frames = JSON.parse(readFileSync(`data/entities/${name}/frames.json`, "utf8")) as Record<string, unknown>;
    expect(onDisk).toEqual(withBasics(onDisk, recipes, frames));
  });
});
