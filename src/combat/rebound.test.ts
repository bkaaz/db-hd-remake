import { describe, expect, it } from "vitest";
import { reboundSpeed } from "./rebound";

const knockdown = { share: 0.25, min: 2 };

describe("a rebound off the floor", () => {
  it("goes back up at a quarter of the speed it landed with", () => {
    expect(reboundSpeed(knockdown, 12)).toBe(-3);
  });

  it("never slower than the floor — an ordinary knockdown lands at 4 and leaves at 2", () => {
    expect(reboundSpeed(knockdown, 4)).toBe(-2);
  });
});
