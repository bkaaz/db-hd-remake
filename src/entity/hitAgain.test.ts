import { describe, expect, it } from "vitest";
import { hitAgain, hitAgainProblem } from "./hitAgain";

const HIGH = { to: "reel_high", times: 2, then: "reel_down" };

describe("ifHitAgain", () => {
  it("sends the body back into the reaction twice, then floors it — as 1e does", () => {
    expect([1, 2, 3, 4].map((n) => hitAgain(HIGH, n))).toEqual(["reel_high", "reel_high", "reel_down", "reel_down"]);
  });

  it("names a missing state and a count that is not one", () => {
    const states = new Set(["reel_high", "reel_down"]);
    expect(hitAgainProblem(HIGH, (n) => states.has(n))).toBeNull();
    expect(hitAgainProblem({ ...HIGH, then: "nowhere" }, (n) => states.has(n))).toContain("nowhere");
    expect(hitAgainProblem({ ...HIGH, times: -1 }, (n) => states.has(n))).toContain("whole number");
  });
});
