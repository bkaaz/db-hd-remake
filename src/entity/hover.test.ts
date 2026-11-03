import { describe, expect, it } from "vitest";
import { hoverOffset } from "./hover";

describe("hoverOffset", () => {
  it("rises a pixel every 4 frames to 6 up, then sinks back, 48 frames round", () => {
    const path = Array.from({ length: 48 }, (_, f) => hoverOffset(f));
    expect(path.slice(0, 5)).toEqual([0, 0, 0, -1, -1]);
    expect(Math.min(...path)).toBe(-6);
    expect(path[47]).toBe(0);
    expect(hoverOffset(48)).toBe(hoverOffset(0));
  });
});
