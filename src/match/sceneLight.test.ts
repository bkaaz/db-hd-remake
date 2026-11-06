import { describe, expect, it } from "vitest";
import { barAt, domeRadius } from "./sceneLight";

describe("domeRadius", () => {
  const dome = { from: 10, grow: 4, max: 112, shrink: 8 };

  it("is nothing before it starts, then grows from 1", () => {
    expect(domeRadius(dome, 9)).toBe(0);
    expect(domeRadius(dome, 10)).toBe(1);
    expect(domeRadius(dome, 11)).toBe(5);
  });

  it("stops at its full size, shrinks, and is gone", () => {
    expect(domeRadius(dome, 38)).toBe(112);
    expect(domeRadius(dome, 39)).toBe(104);
    expect(domeRadius(dome, 60)).toBe(0);
  });
});

describe("barAt", () => {
  const bar = { from: 100, until: 135, on: "held" as const, x: [-32, 32] as [number, number], bottom: 0, start: 1, rise: 11, tallest: 192, narrows: { at: 14, by: 1.5, least: 2 } };

  it("exists only in its frames", () => {
    expect(barAt(bar, 99)).toBeNull();
    expect(barAt(bar, 135)).toBeNull();
  });

  it("stands on its bottom and rises to its height", () => {
    expect(barAt(bar, 100)).toEqual({ left: -32, right: 32, top: -1, bottom: 0 });
    expect(barAt(bar, 114)?.top).toBe(-155);
    expect(barAt(bar, 130)?.top).toBe(-192);
  });

  it("narrows to its least, about its middle", () => {
    expect(barAt(bar, 124)).toMatchObject({ left: -17, right: 17 });
    expect(barAt(bar, 134)).toMatchObject({ left: -2, right: 2 });
  });
});
