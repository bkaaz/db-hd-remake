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

describe("a state's several balls", () => {
  // Saiyan Meteor's ae: a flicker at the hands, then one growing over the head
  const meteor = [
    { at: [24, -36] as [number, number], from: 200, until: 274, grow: 0, pulse: [7, 6, 5, 4, 3, 2, 1, 1, 15, 14, 13, 12, 11, 10, 9, 8] },
    { at: [0, -112] as [number, number], from: 306, grow: 1, max: 63 },
  ];

  it("takes the flicker's radius from its table by the frame", () => {
    expect(nextRadius(0, meteor, 200)).toBe(15);
    expect(nextRadius(15, meteor, 214)).toBe(1);
  });

  it("is gone at once between them, not shrinking", () => {
    expect(nextRadius(11, meteor, 274)).toBe(0);
  });

  it("grows the next from nothing and stops at its max", () => {
    expect(nextRadius(0, meteor, 306)).toBe(1);
    expect(nextRadius(63, meteor, 400)).toBe(63);
  });
});

