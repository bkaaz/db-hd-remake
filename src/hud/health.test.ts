import { describe, expect, it } from "vitest";
import { flashStep, layersOf, stepShown } from "./health";

describe("the HUD's health", () => {
  it("drains a point a frame toward the real health, either way", () => {
    expect(stepShown(400, 380)).toBe(399);
    expect(stepShown(50, 55)).toBe(51);
    expect(stepShown(120, 120)).toBe(120);
  });

  it("is drawn in layers of 100, the top one draining", () => {
    expect(layersOf(400)).toEqual({ count: 4, left: 100 });
    expect(layersOf(350)).toEqual({ count: 4, left: 50 });
    expect(layersOf(301)).toEqual({ count: 4, left: 1 });
    expect(layersOf(300)).toEqual({ count: 3, left: 100 });
    expect(layersOf(40)).toEqual({ count: 1, left: 40 });
    expect(layersOf(0)).toEqual({ count: 0, left: 0 });
  });

  it("flashes below 81, three frames a colour: dark red, yellow, orange, red", () => {
    expect(flashStep(81, 0)).toBeNull();
    expect([0, 2, 3, 6, 9, 11, 12].map((frame) => flashStep(80, frame))).toEqual([0, 0, 1, 2, 3, 3, 0]);
  });
});
