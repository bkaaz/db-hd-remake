import { describe, expect, it } from "vitest";
import { rowMajor, type Rect } from "./rowOrder";

/** Rect with a label, so the resulting order is readable in assertions. */
interface Tagged extends Rect {
  id: string;
}
const at = (id: string, x: number, y: number, w = 20, h = 30): Tagged => ({ id, x, y, w, h });
const order = (rects: Tagged[]): string => rowMajor(rects).map((r) => r.id).join("");

describe("rowMajor", () => {
  it("reads left to right, then down", () => {
    const grid = [at("c", 0, 100), at("a", 0, 0), at("d", 40, 100), at("b", 40, 0)];
    expect(order(grid)).toBe("abcd");
  });

  it("keeps a row together when a taller pose starts higher", () => {
    // This is the bug it exists for: "b" is 4px taller and starts 4px higher,
    // so sorting by top edge alone would put it before "a".
    const row = [at("a", 0, 10, 20, 30), at("b", 40, 6, 20, 34)];
    expect(order(row)).toBe("ab");
  });

  it("does not let one tall sprite swallow the row below it", () => {
    const tall = at("a", 0, 0, 20, 90);
    const below = at("b", 40, 100, 20, 30);
    expect(order([below, tall])).toBe("ab");
    // ...and "b" really is treated as its own row, not appended to the first.
    const alsoBelow = at("c", 0, 100, 20, 30);
    expect(order([tall, below, alsoBelow])).toBe("acb");
  });

  it("groups sprites that overlap most of their height", () => {
    // Half-height overlap is the cut-off; 20 of 30px shared stays one row.
    const row = [at("b", 40, 10, 20, 30), at("a", 0, 0, 20, 30)];
    expect(order(row)).toBe("ab");
  });

  it("handles a single row and an empty sheet", () => {
    expect(order([at("b", 30, 0), at("a", 0, 0)])).toBe("ab");
    expect(rowMajor([])).toEqual([]);
  });

  it("leaves the input array untouched", () => {
    const input = [at("b", 40, 0), at("a", 0, 0)];
    rowMajor(input);
    expect(input.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
