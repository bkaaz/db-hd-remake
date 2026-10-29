import { describe, expect, it } from "vitest";
import { nextRadius } from "./ball";

const charge = { at: [-10, -38] as [number, number], from: 16, grow: 2 };

describe("the charging ball", () => {
  it("appears at radius 1 on its frame, not before", () => {
    expect(nextRadius(0, charge, 15)).toBe(0);
    expect(nextRadius(0, charge, 16)).toBe(1);
  });

  it("grows by 2 a frame while charged — 53 by the original's full charge", () => {
    let r = 1;
    for (let frame = 17; frame <= 42; frame++) r = nextRadius(r, charge, frame);
    expect(r).toBe(53);
  });

  it("carries on in a state that holds it without starting one", () => {
    const carried = { at: charge.at, grow: 2 };
    expect(nextRadius(9, carried, 0)).toBe(11);
    expect(nextRadius(0, carried, 0)).toBe(0);
  });

  it("shrinks by 2 a frame once let go, and is gone at 0", () => {
    expect(nextRadius(3, undefined, 0)).toBe(1);
    expect(nextRadius(1, undefined, 0)).toBe(0);
  });
});
