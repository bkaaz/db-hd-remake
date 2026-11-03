import { describe, expect, it } from "vitest";
import { burnVariant, glowVariant, shimmerVariant } from "./palettes";

const fire = Array.from({ length: 15 }, (_, i) => `fire${i}`);

describe("burning", () => {
  it("steps to the next fire palette every 2 frames", () => {
    expect([0, 1, 2, 3, 4].map((f) => burnVariant(fire, f))).toEqual(["fire0", "fire0", "fire1", "fire1", "fire2"]);
  });

  it("goes round all of them, for as long as it lasts", () => {
    expect(burnVariant(fire, 29)).toBe("fire14");
    expect(burnVariant(fire, 30)).toBe("fire0");
  });

  it("shows nothing on a fighter with no burn sheets", () => {
    expect(burnVariant([], 3)).toBeUndefined();
  });
});

describe("shimmerVariant", () => {
  it("steps every 4 frames from its own palette through the run and round again", () => {
    const run = ["shimmer1", "shimmer2"];
    expect([0, 3, 4, 8, 11, 12].map((f) => shimmerVariant(run, f))).toEqual([undefined, undefined, "shimmer1", "shimmer2", "shimmer2", undefined]);
    expect(shimmerVariant([], 40)).toBeUndefined();
  });
});

describe("glowVariant", () => {
  it("takes the glow of the lighting he is in, and none he does not have", () => {
    const vegeta = (v: string) => ["glow", "evening_glow", "night_glow"].includes(v);
    expect([glowVariant(null, vegeta), glowVariant("night", vegeta)]).toEqual(["glow", "night_glow"]);
    expect(glowVariant("evening", () => false)).toBeUndefined();
  });
});
