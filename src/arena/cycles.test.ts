import { describe, expect, it } from "vitest";
import type { PaletteCycle } from "./arenaFile";
import { CycledPicture } from "./cycles";

const pixel = (r: number, g = 0, b = 0, a = 255) => [r, g, b, a];

/** A row of 16 colours with this red, a row per step. */
const stepsOf = (...reds: number[]) =>
  Uint8Array.from(reds.flatMap((red) => Array.from({ length: 16 }, (_, colour) => pixel(red + colour)).flat()));

const CYCLE: PaletteCycle = { palette: 4, steps: 3, start: 0, hold: 2 };

/** Three pixels: colour 3 of palette 4, colour 5 of palette 2, and a clear one that names palette 4. */
function scene(cycles: { cycle: PaletteCycle; steps: Uint8Array }[]) {
  const picture = Uint8Array.from([...pixel(1), ...pixel(2), ...pixel(3, 0, 0, 0)]);
  const numbers = Uint8Array.from([...pixel(4 * 16 + 3), ...pixel(2 * 16 + 5), ...pixel(4 * 16 + 3, 0, 0, 0)]);
  return { picture, painted: new CycledPicture(picture, numbers, cycles) };
}

describe("CycledPicture", () => {
  it("steps after its hold, repainting only the pixels of its palette and telling so", () => {
    const { picture, painted } = scene([{ cycle: CYCLE, steps: stepsOf(10, 50, 90) }]);
    expect(painted.tick()).toBe(false);
    expect([...picture.subarray(0, 4)]).toEqual(pixel(1));
    expect(painted.tick()).toBe(true);
    expect([...picture.subarray(0, 4)]).toEqual(pixel(50 + 3));
    expect([...picture.subarray(4, 8)]).toEqual(pixel(2));
    expect([...picture.subarray(8, 12)]).toEqual(pixel(3, 0, 0, 0));
  });

  it("goes round past its last step", () => {
    const { picture, painted } = scene([{ cycle: CYCLE, steps: stepsOf(10, 50, 90) }]);
    for (let i = 0; i < 6; i++) painted.tick();
    expect(picture[0]).toBe(10 + 3);
  });

  it("holds each step its own length when the holds are a list", () => {
    const { picture, painted } = scene([{ cycle: { ...CYCLE, hold: [1, 3, 1] }, steps: stepsOf(10, 50, 90) }]);
    expect(painted.tick()).toBe(true);
    expect(picture[0]).toBe(53);
    expect([painted.tick(), painted.tick()]).toEqual([false, false]);
    expect(painted.tick()).toBe(true);
    expect(picture[0]).toBe(93);
  });

  it("starts from the step it is told, and keeps each palette on its own clock", () => {
    const { picture, painted } = scene([
      { cycle: { ...CYCLE, start: 1 }, steps: stepsOf(10, 50, 90) },
      { cycle: { palette: 2, steps: 2, start: 0, hold: 3 }, steps: stepsOf(100, 150) },
    ]);
    painted.tick();
    painted.tick();
    expect(picture[0]).toBe(93);
    expect(picture[4]).toBe(2);
    painted.tick();
    expect(picture[4]).toBe(155);
  });
});
