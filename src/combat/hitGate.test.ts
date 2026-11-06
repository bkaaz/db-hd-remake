import { describe, expect, it } from "vitest";
import { outOfReach } from "./hitGate";

describe("outOfReach", () => {
  it("keeps a body thrown up safe until he has left the floor by 17 px", () => {
    expect(outOfReach(0x1e, 1, 8)).toBe(true);
    expect(outOfReach(0x1e, 1, 16)).toBe(true);
    expect(outOfReach(0x1e, 1, 17)).toBe(false);
  });

  it("and for good once he has come down, however high the bounce", () => {
    expect(outOfReach(0x1e, 2, 60)).toBe(false);
    expect(outOfReach(0x1e, 3, 60)).toBe(true);
  });

  it("says nothing of any other move", () => {
    expect(outOfReach(0x1b, 1, 0)).toBe(false);
    expect(outOfReach(null, 3, 0)).toBe(false);
  });
});
