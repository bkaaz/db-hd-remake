import { describe, expect, it } from "vitest";
import type { BlowAnim } from "./rushSlots";
import { withTempo } from "./rushTempo";

const anims: Record<string, BlowAnim> = {
  kick: { steps: [{ frame: "70", dur: 4 }, { frame: "71", dur: 6, boxes: [{ type: "hit" }] }, { frame: "70", dur: 1 }] },
  other: { steps: [{ frame: "70", dur: 10 }] },
};

describe("withTempo", () => {
  it("plays each picked blow's steps faster, in whole frames, one at least", () => {
    expect(withTempo(anims, { rush_1: { anim: "kick" } }, 1.5).kick.steps.map((s) => s.dur)).toEqual([3, 4, 1]);
    expect(withTempo(anims, { rush_1: { anim: "kick" } }, 0.8).kick.steps.map((s) => s.dur)).toEqual([5, 8, 1]);
  });

  it("leaves what is not picked, and the animations it was given, as they were", () => {
    const fast = withTempo(anims, { rush_1: { anim: "kick" } }, 1.5);
    expect(fast.other).toBe(anims.other);
    expect(anims.kick.steps[0].dur).toBe(4);
  });

  it("changes nothing at 100%", () => {
    expect(withTempo(anims, { rush_1: { anim: "kick" } }, 1)).toBe(anims);
  });
});
