import { describe, expect, it } from "vitest";
import { shoveAfter, slowed } from "./knockback";

/** Every frame's movement of a push, applied then slowed, until it stops. */
function travel(speed: number): number[] {
  const frames: number[] = [];
  for (let v = speed; v !== 0; v = slowed(v)) frames.push(v);
  return frames;
}

describe("knockback", () => {
  it("dies out in the frames the cartridge counts: 8 for light, 12 for heavy", () => {
    expect(travel(-2)).toHaveLength(8);
    expect(travel(-3)).toHaveLength(12);
  });

  it("carries a heavy reaction 19.5 px, not the 80 a constant speed did", () => {
    const total = travel(-3).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(-19.5);
  });

  it("stops at zero rather than turning round", () => {
    expect(slowed(0.1)).toBe(0);
    expect(slowed(-0.1)).toBe(0);
    expect(slowed(0)).toBe(0);
  });
});
describe("the shove", () => {
  it("slows by friction when its state says nothing", () => {
    expect(shoveAfter(-3, 1, undefined)).toBe(slowed(-3));
  });

  it("keeps its whole speed for `shoveFor` frames, then stops", () => {
    expect(shoveAfter(-3, 11, 12)).toBe(-3);
    expect(shoveAfter(-3, 12, 12)).toBe(0);
  });
});
