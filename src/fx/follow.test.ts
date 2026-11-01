import { describe, expect, it } from "vitest";
import { followedFrame } from "./follow";

describe("followedFrame", () => {
  it("shows the frame its owner's drawing names by its low bits, a0 to a2", () => {
    expect(followedFrame(String(0xa0))).toBe("0");
    expect(followedFrame(String(0xa2))).toBe("2");
  });

  it("is gone from a drawing whose low bits are 3 or more — Goku back in his own hair", () => {
    expect(followedFrame(String(0xa3))).toBeNull();
    expect(followedFrame(undefined)).toBeNull();
  });
});
