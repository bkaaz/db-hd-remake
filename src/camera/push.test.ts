import { describe, expect, it } from "vitest";
import { pushOf } from "./push";

const SCREEN = 256;

describe("pushOf", () => {
  it("is nothing while both stand away from the edges", () => {
    expect(pushOf({ x: 100, d: 2 }, { x: 150, d: -2 }, SCREEN)).toBe(0);
  });

  it("is a fighter's own move in the outer 64 px, toward that edge only", () => {
    expect(pushOf({ x: 200, d: 2 }, { x: 128, d: 0 }, SCREEN)).toBe(2);
    expect(pushOf({ x: 200, d: -2 }, { x: 128, d: 0 }, SCREEN)).toBe(0);
    expect(pushOf({ x: 40, d: -1.5 }, null, SCREEN)).toBe(-1.5);
    expect(pushOf({ x: 40, d: 1.5 }, null, SCREEN)).toBe(0);
  });

  it("counts the band from 64 px in, inclusive on the right", () => {
    expect(pushOf({ x: 192, d: 1 }, null, SCREEN)).toBe(1);
    expect(pushOf({ x: 191, d: 1 }, null, SCREEN)).toBe(0);
    expect(pushOf({ x: 64, d: -1 }, null, SCREEN)).toBe(0);
    expect(pushOf({ x: 63, d: -1 }, null, SCREEN)).toBe(-1);
  });

  it("takes the faster of two pushing toward the same edge", () => {
    expect(pushOf({ x: 200, d: 2 }, { x: 230, d: 3 }, SCREEN)).toBe(3);
    expect(pushOf({ x: 20, d: -2 }, { x: 50, d: 1 }, SCREEN)).toBe(-2);
    expect(pushOf({ x: 20, d: 1 }, { x: 50, d: 2 }, SCREEN)).toBe(0);
  });

  it("adds two at opposite edges moving apart, so they cancel", () => {
    expect(pushOf({ x: 20, d: -2 }, { x: 230, d: 2 }, SCREEN)).toBe(0);
    expect(pushOf({ x: 20, d: -2 }, { x: 230, d: 1 }, SCREEN)).toBe(-1);
  });

  it("takes the larger of two at opposite edges moving the same way", () => {
    expect(pushOf({ x: 20, d: 1 }, { x: 230, d: 3 }, SCREEN)).toBe(3);
  });
});
