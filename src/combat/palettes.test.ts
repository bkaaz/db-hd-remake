import { describe, expect, it } from "vitest";
import { burnVariant, paletteVariant, shimmerVariant, runVariant } from "./palettes";

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

describe("paletteVariant", () => {
  const vegeta = (v: string) => ["night", "glow", "night_glow", "alt", "night_alt", "night_glow_alt"].includes(v);
  const goku = (v: string) => ["night", "alt", "night_alt"].includes(v);

  it("puts the lighting, the glow and player two's colours together", () => {
    expect(paletteVariant({ lighting: "night", glow: true, alt: true }, vegeta)).toBe("night_glow_alt");
    expect(paletteVariant({ lighting: null, glow: true, alt: false }, vegeta)).toBe("glow");
    expect(paletteVariant({ lighting: null, glow: false, alt: false }, vegeta)).toBeNull();
  });

  it("adds a colour set of ours last, and drops it where he has no such sheet", () => {
    const sets = (v: string) => ["night_glow_alt_gold", "gold", "night"].includes(v);
    expect(paletteVariant({ lighting: "night", glow: true, alt: true, set: "gold" }, sets)).toBe("night_glow_alt_gold");
    expect(paletteVariant({ lighting: null, glow: false, alt: false, set: "gold" }, sets)).toBe("gold");
    expect(paletteVariant({ lighting: "night", glow: false, alt: false, set: "silver" }, sets)).toBe("night");
  });

  it("puts his winning colours where the glow goes, and drops them where he has none", () => {
    const wins = (v: string) => ["night_win_alt", "win", "night"].includes(v);
    expect(paletteVariant({ lighting: "night", glow: false, win: true, alt: true }, wins)).toBe("night_win_alt");
    expect(paletteVariant({ lighting: null, glow: false, win: true, alt: false }, wins)).toBe("win");
    expect(paletteVariant({ lighting: "night", glow: false, win: true, alt: false }, goku)).toBe("night");
  });

  it("drops a glow he has no sheet for, and keeps player two's colours", () => {
    expect(paletteVariant({ lighting: "night", glow: true, alt: true }, goku)).toBe("night_alt");
    expect(paletteVariant({ lighting: "night", glow: true, alt: false }, goku)).toBe("night");
  });
});

describe("runVariant", () => {
  const run = ["a", "b", "c", "d", "e"];

  it("starts on frame 1, the first a frame short, then four frames each", () => {
    expect([0, 1, 3, 4, 7, 8, 16, 19].map((f) => runVariant(run, f))).toEqual([undefined, "a", "a", "b", "b", "c", "e", "e"]);
  });

  it("is over after the last", () => {
    expect(runVariant(run, 20)).toBeUndefined();
  });
});
