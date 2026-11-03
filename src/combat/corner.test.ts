import { describe, expect, it } from "vitest";
import { moveOf, passedShove, type Shoved } from "./corner";

const SCREEN = { min: 116, max: 340 };
/** Facing right, shoved back (left) at 2 px a frame, standing on the screen's left edge, knocked down. */
const pinned: Shoved = { x: 116, facing: 1, shove: -2, move: 0x1b, health: 100 };
const hitter = { facing: -1 as const };

describe("passedShove", () => {
  it("passes a shove into the screen's edge to the other, back the way he faces", () => {
    // the pinned one was going left; the hitter, facing left, goes right — backwards for him
    expect(passedShove(pinned, hitter, SCREEN)).toBe(-2);
  });

  it("keeps it short of the edge, or going away from it", () => {
    expect(passedShove({ ...pinned, x: 117 }, hitter, SCREEN)).toBeNull();
    expect(passedShove({ ...pinned, shove: 2 }, hitter, SCREEN)).toBeNull();
  });

  it("is tested at the right edge the same way", () => {
    expect(passedShove({ ...pinned, x: 340, facing: -1 }, { facing: 1 }, SCREEN)).toBe(-2);
  });

  it("stays with a standing reel, and with a body out of health", () => {
    expect(passedShove({ ...pinned, move: 0x13 }, hitter, SCREEN)).toBeNull();
    expect(passedShove({ ...pinned, health: 0 }, hitter, SCREEN)).toBeNull();
  });

  it("passes a blocked blow's shove — the guard, 0d, is not in the table", () => {
    expect(passedShove({ ...pinned, move: 0x0d }, hitter, SCREEN)).toBe(-2);
  });
});

describe("moveOf", () => {
  it("reads the move from a cartridge animation's name, and nothing from any other", () => {
    expect(moveOf("m13")).toBe(0x13);
    expect(moveOf("m1b_3")).toBe(0x1b);
    expect(moveOf("punch")).toBeNull();
  });
});
