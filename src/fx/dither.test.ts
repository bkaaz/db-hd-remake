import { describe, expect, it } from "vitest";
import { ditherKeeps, DITHER_LEVELS } from "./dither";

const kept = (level: number) => {
  let n = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherKeeps(level, x, y)) n++;
  return n;
};

describe("ditherKeeps", () => {
  it("keeps every pixel at the top and none at 0, as many as the level in each 4×4", () => {
    expect([kept(DITHER_LEVELS), kept(0), kept(8), kept(4)]).toEqual([16, 0, 8, 4]);
  });

  it("only takes pixels away as the level falls: a dissolve never brings one back", () => {
    for (let level = 1; level <= DITHER_LEVELS; level++)
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherKeeps(level - 1, x, y)) expect(ditherKeeps(level, x, y)).toBe(true);
  });

  it("thins out evenly: half the level is every other pixel, a checkerboard", () => {
    const row = (y: number) => [0, 1, 2, 3].map((x) => ditherKeeps(8, x, y));
    expect([row(0), row(1)]).toEqual([
      [true, false, true, false],
      [false, true, false, true],
    ]);
  });
});
