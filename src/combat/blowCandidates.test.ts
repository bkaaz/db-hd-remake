import { describe, expect, it } from "vitest";
import { candidates } from "./blowCandidates";
import type { BlowAnim } from "./rushSlots";

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
