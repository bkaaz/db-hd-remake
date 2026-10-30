import { describe, expect, it } from "vitest";
import { barColour, barTiles, digits, stepShown } from "./health";
import type { HudFile } from "./hudFile";

/** The cartridge's tables ($00:C6C9, $00:C6CF, $00:C6D8): the tile for each px filled. */
const BAR: HudFile["bar"] = {
  first: [6, 5, 4, 3, 2, 1],
  middle: [15, 14, 13, 12, 11, 10, 9, 8, 7],
  last: [21, 20, 19, 18, 17, 16],
  at: [[5, 2], [17, 2]],
  flash: { below: 0x51, hold: 3, cycle: [1, 0, 2, 3] },
};
const FULL = [1, 7, 7, 7, 7, 7, 7, 7, 7, 16];
const EMPTY = [6, 15, 15, 15, 15, 15, 15, 15, 15, 21];

describe("the HUD's health", () => {
  it("drains a pixel's worth a frame toward the real health, either way", () => {
    expect(stepShown(400, 380)).toBe(399);
    expect(stepShown(50, 55)).toBe(51);
    expect(stepShown(120, 120)).toBe(120);
  });

  it("writes three digits, leading zeros kept", () => {
    expect(digits(400)).toEqual([4, 0, 0]);
    expect(digits(77)).toEqual([0, 7, 7]);
    expect(digits(5)).toEqual([0, 0, 5]);
  });

  it("shows a full bar from 150 up, as a fight starting at 400 does", () => {
    expect(barTiles(400, BAR)).toEqual(FULL);
    expect(barTiles(150, BAR)).toEqual(FULL);
    expect(barTiles(149, BAR)).not.toEqual(FULL);
  });

  it("fills the cap, then each tile by 8, from half the health less one", () => {
    // 77 → 38 − 1 = 37: cap 5, four tiles of 8, 0 left
    expect(barTiles(77, BAR)).toEqual([1, 7, 7, 7, 7, 15, 15, 15, 15, 21]);
    // 44 → 21: cap 5, two of 8, then 0
    expect(barTiles(44, BAR)).toEqual([1, 7, 7, 15, 15, 15, 15, 15, 15, 21]);
    // 10 → 4: a part-filled cap
    expect(barTiles(10, BAR)).toEqual([2, ...EMPTY.slice(1)]);
  });

  it("keeps its colour from 81 up, and below flashes 3 frames a colour, 12 a cycle", () => {
    expect([0, 1, 2, 3, 6, 9, 12].map((f) => barColour(81, f, BAR.flash))).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect([0, 2, 3, 5, 6, 9, 12].map((f) => barColour(80, f, BAR.flash))).toEqual([1, 1, 0, 0, 2, 3, 1]);
  });

  it("keeps a sliver while any health is left, and none at zero", () => {
    expect(barTiles(1, BAR)).toEqual([5, ...EMPTY.slice(1)]);
    expect(barTiles(0, BAR)).toEqual(EMPTY);
  });
});
