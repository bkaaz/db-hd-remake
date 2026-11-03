import { describe, expect, it } from "vitest";
import { leftMove, moveOfAnim, movesHeld } from "./thrownIn";

describe("thrownIn", () => {
  it("reads the move from an exported animation and its parts", () => {
    expect([moveOfAnim("mac"), moveOfAnim("mac_2"), moveOfAnim("punch")]).toEqual(["ac", "ac", "punch"]);
  });

  it("keeps a bolt through every part of the move it went out in, and no further", () => {
    const moves = movesHeld(true, "mab");
    expect([leftMove(moves, "mab_2"), leftMove(moves, "m00")]).toEqual([false, true]);
  });

  it("keeps Final Flash's head through ac and its hold b5 ($0F:BE66)", () => {
    const moves = movesHeld(["ac", "b5"], "mac_2");
    expect([leftMove(moves, "mb5"), leftMove(moves, "mac_2"), leftMove(moves, "m00")]).toEqual([false, false, true]);
  });
});
