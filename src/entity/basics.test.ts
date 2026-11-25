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

  it("cuts the steps asked for, his stance before and after, named b_<name>", () => {
    expect(made.b_jab.steps.map((s) => [s.frame, s.dur])).toEqual([["70", 4], ["77", 4], ["78", 6], ["70", 4]]);
  });

  it("keeps the swing and leaves the landing to the engine, which plays it when the blow lands", () => {
    expect(made.b_jab.steps.map((s) => s.sfx)).toEqual([undefined, undefined, [7], undefined]);
  });

  it("puts out no spark of its own: the engine draws one where a blow lands", () => {
    expect(made.b_jab.steps.some((s) => s.spawns)).toBe(false);
  });

  it("keeps the hit boxes of the steps it cuts", () => {
    expect(made.b_jab.steps[1].boxes).toEqual([hit]);
  });

  it("refuses an animation or steps that are not there", () => {
    expect(() => basicAnims({ x: { from: "nope", steps: [0, 0] } }, anims)).toThrow(/no animation nope/);
    expect(() => basicAnims({ x: { from: "mae", steps: [1, 5] } }, anims)).toThrow(/no steps 1–5/);
  });
});

describe("withBasics", () => {
  it("makes them again, and drops one whose recipe is gone", () => {
    const before = withBasics(anims, { jab: { from: "mae", steps: [0, 1] } });
    const after = withBasics(before, { kick: { from: "mae", steps: [2, 2] } });
    expect(Object.keys(after).sort()).toEqual(["b_kick", "m90", "mae"]);
  });
});

describe.each(generatedFighters().filter((n) => existsSync(`data/entities/${n}/basics.json`)))("%s's basic blows on disk", (name) => {
  it("are what his basics.json makes — npm run basics", () => {
    const onDisk = JSON.parse(readFileSync(`data/entities/${name}/animations.json`, "utf8")) as Record<string, Anim>;
    const recipes = JSON.parse(readFileSync(`data/entities/${name}/basics.json`, "utf8")) as BasicsFile;
    expect(onDisk).toEqual(withBasics(onDisk, recipes));
  });
});
