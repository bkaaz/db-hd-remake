import { describe, expect, it } from "vitest";
import { variantAt } from "./palettes";

// The Kamehameha's fire as recorded: 4 for the 10 frames of hitstop, then 5–9 two each.
const fire: [string, number][] = [["fire4", 10], ["fire5", 2], ["fire6", 2], ["fire7", 2], ["fire8", 2], ["fire9", 2]];

describe("a palette run", () => {
  it("holds each variant for its frames, in order", () => {
    expect([0, 9, 10, 11, 12, 19].map((f) => variantAt(fire, f))).toEqual(["fire4", "fire4", "fire5", "fire5", "fire6", "fire9"]);
  });

  it("is over after its last frame: the sprite's own palette again", () => {
    expect(variantAt(fire, 20)).toBeNull();
  });
});
