import { describe, expect, it } from "vitest";
import { bodyOverlap, pushApart, separate, type Bounds } from "./push";

const WIDE: Bounds = { min: -1000, max: 1000 };
/** Two fighters 20 wide each: they must stay at least 20 apart, centre to centre. */
const body = (x: number) => ({ x, half: 10 });

describe("separate", () => {
  it("leaves bodies that are not touching alone", () => {
    expect(separate(body(0), body(50), WIDE)).toEqual({ ax: 0, bx: 50 });
  });

  it("leaves bodies that are exactly touching alone", () => {
    expect(separate(body(0), body(20), WIDE)).toEqual({ ax: 0, bx: 20 });
  });

  it("splits the correction evenly, which is what makes a push cost speed", () => {
    // 6 of overlap: each gives 3, so a walker advancing 6 nets 3 and moves the
    // other 3 — "you keep going, slower, and they slide".
    expect(separate(body(0), body(14), WIDE)).toEqual({ ax: -3, bx: 17 });
  });

  it("works whichever side the other body is on", () => {
    expect(separate(body(14), body(0), WIDE)).toEqual({ ax: 17, bx: -3 });
  });

  it("picks a side when they are exactly on top of each other", () => {
    const { ax, bx } = separate(body(5), body(5), WIDE);
    expect(Math.abs(bx - ax)).toBe(20);
  });

  it("pushes the free body all the way when the other is against a wall", () => {
    // "a" is pinned at the left edge, so "b" has to absorb the whole overlap.
    const bounds: Bounds = { min: 0, max: 1000 };
    const { ax, bx } = separate(body(0), body(14), bounds);
    expect(ax).toBe(0);
    expect(bx).toBe(20);
  });

  it("pushes back off the right-hand wall too", () => {
    const bounds: Bounds = { min: 0, max: 100 };
    const { ax, bx } = separate(body(90), body(100), bounds);
    expect(bx).toBe(100);
    expect(ax).toBe(80);
  });

  it("always ends up at least the required distance apart", () => {
    const bounds: Bounds = { min: 0, max: 200 };
    for (let gap = 0; gap <= 20; gap++) {
      const { ax, bx } = separate(body(100), body(100 + gap), bounds);
      expect(Math.abs(bx - ax)).toBeGreaterThanOrEqual(20);
    }
  });

  it("respects bodies of different widths", () => {
    const { ax, bx } = separate({ x: 0, half: 5 }, { x: 10, half: 20 }, WIDE);
    expect(bx - ax).toBe(25);
  });
});

/** A body 20 wide and 50 tall standing at x, its feet `up` px above the floor at 0. */
const rect = (x: number, up = 0) => ({ x: x - 10, y: -50 - up, w: 20, h: 50 });

describe("bodyOverlap", () => {
  it("measures how far two bodies overlap along x", () => {
    expect(bodyOverlap([rect(0)], [rect(14)], true)).toBe(6);
    expect(bodyOverlap([rect(14)], [rect(0)], false)).toBe(6);
  });

  it("meets a body in the air as one on the ground: the jump that went through", () => {
    expect(bodyOverlap([rect(0, 30)], [rect(14, 20)], true)).toBe(6);
  });

  it("lets a body high enough pass over another", () => {
    expect(bodyOverlap([rect(0, 60)], [rect(14)], true)).toBe(0);
  });

  it("lets a head meet a body when the bodies miss", () => {
    const head = { x: 2, y: -70, w: 6, h: 10 };
    expect(bodyOverlap([rect(0), head], [rect(10, 55)], true)).toBe(8);
  });

  it("pushes nothing without boxes, as a lying fighter has", () => {
    expect(bodyOverlap([], [rect(0)], true)).toBe(0);
  });
});

describe("pushApart", () => {
  it("moves each half the overlap, away from the other", () => {
    expect(pushApart(0, 14, 6, WIDE)).toEqual({ ax: -3, bx: 17 });
    expect(pushApart(14, 0, 6, WIDE)).toEqual({ ax: 17, bx: -3 });
  });
});
