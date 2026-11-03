import { describe, expect, it } from "vitest";
import { followedFrame, moveStep, riding, type Owner } from "./follow";

const owner = (o: Partial<Owner>): Owner => ({ play: 3, drawing: "0", move: 0x3e, step: 0, ...o });
const since = { play: 3, move: 0x3e };

describe("riding", () => {
  it("plays its own animation on the body while the owner's animation is the one that put it out", () => {
    expect(riding("body", since, owner({}))).toBe("own");
  });

  it("is gone once the owner starts another animation, or the same one again", () => {
    expect(riding("body", since, owner({ play: 4 }))).toBeNull();
    expect(riding("pose", since, owner({ play: 4, drawing: String(0xa0) }))).toBeNull();
  });

  it("by pose, shows the frame the owner's drawing names", () => {
    expect(riding("pose", since, owner({ drawing: String(0xa1) }))).toBe("1");
  });

  it("by step, shows his move's step less its own, through every part of the move", () => {
    expect(riding({ step: 3 }, since, owner({ step: 3 }))).toBe("0");
    expect(riding({ step: 3 }, since, owner({ play: 5, step: 6 }))).toBe("3");
  });

  it("by step, is gone once he leaves the move", () => {
    expect(riding({ step: 3 }, since, owner({ move: 0x00, step: 4 }))).toBeNull();
    expect(riding({ step: 3 }, since, owner({ move: null, step: 4 }))).toBeNull();
  });
});

describe("moveStep", () => {
  const steps = (anim: string) => ({ m3e: 5, m3e_2: 2 })[anim];

  it("counts the steps of the parts before it", () => {
    expect(moveStep("m3e", 3, steps)).toBe(3);
    expect(moveStep("m3e_2", 1, steps)).toBe(6);
  });

  it("is the step itself for an animation that is no part of a move", () => {
    expect(moveStep("idle", 2, steps)).toBe(2);
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
