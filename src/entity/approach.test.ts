import { describe, expect, it } from "vitest";
import { approachSpeed, rushStep } from "./approach";

// Side Slash's: a 32nd of the way to 8 px short of the opponent
const SIDE_SLASH = { at: 28, short: 8, over: 32 };

describe("approachSpeed", () => {
  it("takes a share of the way to a point short of the opponent, in whole px", () => {
    // 136 px away: 128 to go, 4 a frame
    expect(approachSpeed(SIDE_SLASH, 136)).toBe(4);
    // 100 px away: 92 to go, 2.875 a frame, kept as 2
    expect(approachSpeed(SIDE_SLASH, 100)).toBe(2);
  });

  it("does not move closer than a whole px a frame allows", () => {
    expect(approachSpeed(SIDE_SLASH, 39)).toBe(0);
  });

  it("measures the distance the same on either side", () => {
    expect(approachSpeed(SIDE_SLASH, -136)).toBe(4);
  });

  it("backs off, rounded toward zero, when already inside the point", () => {
    expect(approachSpeed({ at: 0, short: 40, over: 4 }, 30)).toBe(-2);
  });
});

describe("rushStep", () => {
  const METEOR = { from: 48, speed: 16, stop: 40 };

  it("moves at its speed toward the opponent while he is farther than the stop", () => {
    expect(rushStep(METEOR, 100)).toEqual({ dx: 16, arrived: false });
    expect(rushStep(METEOR, -100)).toEqual({ dx: -16, arrived: false });
  });

  it("sets down exactly the stop short of him, from either side", () => {
    // 34 to the right: back off to 40 short
    expect(rushStep(METEOR, 34)).toEqual({ dx: -6, arrived: true });
    expect(rushStep(METEOR, -34)).toEqual({ dx: 6, arrived: true });
  });

  it("stops at 40 from the left but only under 40 from the right, as the original does", () => {
    expect(rushStep(METEOR, 40).arrived).toBe(true);
    expect(rushStep(METEOR, -40).arrived).toBe(false);
  });
});
