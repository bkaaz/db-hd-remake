import { describe, expect, it } from "vitest";
import { followedFrame, riding } from "./follow";

describe("riding", () => {
  it("plays its own animation on the body while the owner's animation is the one that put it out", () => {
    expect(riding("body", 3, { play: 3, drawing: "0" })).toBe("own");
  });

  it("is gone once the owner starts another animation, or the same one again", () => {
    expect(riding("body", 3, { play: 4, drawing: "0" })).toBeNull();
    expect(riding("pose", 3, { play: 4, drawing: String(0xa0) })).toBeNull();
  });

  it("by pose, shows the frame the owner's drawing names", () => {
    expect(riding("pose", 3, { play: 3, drawing: String(0xa1) })).toBe("1");
  });
});

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
