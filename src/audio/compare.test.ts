import { describe, expect, it } from "vitest";
import { likeness, resample } from "./compare";

/** A burst of noise, the same every time for one seed. */
function noise(length: number, seed: number): Float32Array {
  let s = seed;
  return Float32Array.from({ length }, () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1);
}

describe("likeness", () => {
  it("is 1 for a sound against itself, wherever it starts", () => {
    const a = noise(500, 1);
    const later = new Float32Array(900);
    later.set(a, 300);
    expect(likeness(a, a)).toBeCloseTo(1, 5);
    expect(likeness(a, later)).toBeCloseTo(1, 5);
  });

  it("is low for two unrelated sounds", () => {
    expect(likeness(noise(500, 1), noise(500, 2))).toBeLessThan(0.2);
  });
});

describe("resample", () => {
  it("keeps a sound's length in time", () => {
    expect(resample(new Float32Array(32000), 32000, 16000).length).toBe(16000);
  });
});
