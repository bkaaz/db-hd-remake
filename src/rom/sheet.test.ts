import { describe, expect, it } from "vitest";
import type { Rgba } from "../sprites/png";
import { packSheet, type Placed } from "./sheet";

/** A w×h image filled with one value, so a copy can be traced back to it. */
function solid(w: number, h: number, v: number): Rgba {
  return { width: w, height: h, data: new Uint8Array(w * h * 4).fill(v) };
}

const item = (id: string, w: number, h: number, v: number): Placed => ({
  id,
  image: solid(w, h, v),
  origin: { x: 1, y: h },
});

describe("packSheet", () => {
  it("puts each drawing where its frame says, with its origin as the anchor", () => {
    const { sheet, frames } = packSheet([item("a", 3, 2, 10), item("b", 2, 4, 20)], 64, 1);
    expect(frames.a).toEqual({ x: 1, y: 1, w: 3, h: 2, anchor: [1, 2] });
    expect(frames.b).toEqual({ x: 5, y: 1, w: 2, h: 4, anchor: [1, 4] });
    const at = (x: number, y: number) => sheet.data[(y * sheet.width + x) * 4];
    expect([at(1, 1), at(3, 2), at(5, 1), at(6, 4)]).toEqual([10, 10, 20, 20]);
    expect(at(4, 1)).toBe(0); // the gap stays empty
  });

  it("starts a new row below the tallest drawing of the last one", () => {
    const { frames, sheet } = packSheet([item("a", 6, 5, 1), item("b", 6, 2, 2)], 10, 1);
    expect(frames.b).toMatchObject({ x: 1, y: 7 });
    expect(sheet.height).toBe(10);
  });

  it("refuses a drawing that cannot fit any row", () => {
    expect(() => packSheet([item("a", 20, 1, 1)], 10)).toThrow(/wider than the sheet/);
  });
});
