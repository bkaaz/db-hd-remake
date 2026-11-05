import { describe, expect, it } from "vitest";
import { shadowSize } from "./shadow";

describe("shadowSize", () => {
  it("is widest from the floor up to y 168, a step narrower every 16 px", () => {
    expect(shadowSize(200)).toBe(0);
    expect(shadowSize(184)).toBe(0);
    expect(shadowSize(169)).toBe(0);
    expect(shadowSize(168)).toBe(1);
    expect(shadowSize(152)).toBe(2);
    expect(shadowSize(136)).toBe(3);
  });

  it("is gone too high and below the floor", () => {
    expect(shadowSize(121)).toBe(3);
    expect(shadowSize(120)).toBeNull();
    expect(shadowSize(202)).toBe(0);
    expect(shadowSize(203)).toBeNull();
  });
});
