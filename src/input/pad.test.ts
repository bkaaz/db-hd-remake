import { describe, expect, it } from "vitest";
import { Pad, readPads, type PadState } from "./pad";

/** A standard-mapping pad with these buttons down and the left stick at x, y. */
function pad(down: number[], x = 0, y = 0): PadState {
  return { buttons: [...Array(17)].map((_, i) => ({ pressed: down.includes(i) })), axes: [x, y, 0, 0] };
}

describe("readPads", () => {
  it("plays Burst Limit's layout: A guards, B blasts, X rushes, Y smashes, LB dashes, RB charges", () => {
    const down = readPads([pad([0, 1, 2, 3, 4, 5])]);
    expect([...down].sort()).toEqual(["attack", "blast", "charge", "dash", "guard", "smash"]);
  });

  it("takes a stick pushed to a diagonal as both directions, and a resting one as none", () => {
    expect([...readPads([pad([], 0.7, 0.7)])].sort()).toEqual(["down", "right"]);
    expect(readPads([pad([], 0.2, -0.3)]).size).toBe(0);
  });

  it("takes the d-pad as directions", () => {
    expect([...readPads([pad([12, 14])])].sort()).toEqual(["left", "up"]);
  });

  it("skips a slot with no pad in it", () => {
    expect([...readPads([null, pad([3])])]).toEqual(["smash"]);
  });
});

describe("Pad", () => {
  it("presses a button on the frame it goes down, and holds it while down", () => {
    const frames = [pad([2]), pad([2]), pad([])];
    let at = 0;
    const p = new Pad(() => [frames[at++]]);
    const seen = frames.map(() => p.frame()).map((f) => [f.attack, f.holding.attack]);
    expect(seen).toEqual([[true, true], [false, true], [false, false]]);
  });
});
