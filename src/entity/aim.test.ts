import { describe, expect, it } from "vitest";
import { aimSpeed, type Aim } from "./aim";

const GHOST: Aim = { from: 36, above: 32, within: 16, speed: 2.12 };

// logs/fight-9.txt: a ghost at y 128 for a body on the floor at 200 goes down, and stops at 153
describe("aimSpeed", () => {
  it("goes down toward a body under it, and rests within the band over his feet", () => {
    expect(aimSpeed(GHOST, 128 - 200)).toBe(2.12);
    expect(aimSpeed(GHOST, 153 - 200)).toBe(0);
  });

  it("climbs after a body that jumped, and rests the band's edge away", () => {
    expect(aimSpeed(GHOST, 134 - 90)).toBe(-2.12);
    expect(aimSpeed(GHOST, -32 + 16)).toBe(-2.12);
    expect(aimSpeed(GHOST, -32 + 15)).toBe(0);
  });
});
