import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { pushWidth, readBoxes } from "./collision";

/** One 32-byte record: slots given as [slot, x1, y1, x2, y2], the rest unused. */
function record(...slots: number[][]): Uint8Array {
  const r = new Uint8Array(32).fill(0x80);
  for (const [slot, ...xy] of slots) r.set(xy.map((v) => v & 0xff), 4 * slot);
  return r;
}

describe("readBoxes", () => {
  it("reads slots 0-1 as push, 2-3 as hit and 6-7 as hurt, x1 y1 x2 y2 as x y w h", () => {
    const rom = record([0, -14, -54, 14, 0], [1, -2, -65, 9, -54], [2, 21, -55, 49, -41], [6, -9, -78, 15, -56], [7, -23, -65, 26, 0]);
    expect(readBoxes(rom, 0, 0)).toEqual([
      { type: "push", x: -14, y: -54, w: 28, h: 54 },
      { type: "push", x: -2, y: -65, w: 11, h: 11 },
      { type: "hit", x: 21, y: -55, w: 28, h: 14 },
      { type: "hurt", x: -9, y: -78, w: 24, h: 22 },
      { type: "hurt", x: -23, y: -65, w: 49, h: 65 },
    ]);
  });

  it("keeps one copy when slot 3 repeats slot 2", () => {
    const rom = record([2, 1, 2, 3, 4], [3, 1, 2, 3, 4]);
    expect(readBoxes(rom, 0, 0)).toHaveLength(1);
  });

  it("finds a drawing's record 32 bytes per id from the table", () => {
    const rom = new Uint8Array(64).fill(0x80);
    rom.set(record([6, 0, -10, 5, 0]), 32);
    expect(readBoxes(rom, 0, 1)).toEqual([{ type: "hurt", x: 0, y: -10, w: 5, h: 10 }]);
  });

  it("measures slot 0 for the push width", () => {
    expect(pushWidth(record([0, -14, -54, 14, 0]), 0, 0)).toBe(28);
  });
});

// Drawing 4a is far Y at full stretch; 00 is idle, which throws nothing.
describe.skipIf(!existsSync(ROM_PATH))("readBoxes, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("gives far Y's fist a hit box in front, and idle none", () => {
    const hit = (d: number) => readBoxes(rom, GOKU.boxes, d).filter((b) => b.type === "hit");
    expect(hit(0x4a)).toEqual([{ type: "hit", x: 21, y: -55, w: 28, h: 14 }]);
    expect(hit(0x00)).toEqual([]);
  });
});
