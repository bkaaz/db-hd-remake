import { describe, expect, it } from "vitest";
import { slowed } from "./knockback";

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
