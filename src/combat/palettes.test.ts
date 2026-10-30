import { describe, expect, it } from "vitest";
import { burnVariant } from "./palettes";

const fire = Array.from({ length: 15 }, (_, i) => `fire${i}`);

describe("burning", () => {
  it("steps to the next fire palette every 2 frames", () => {
    expect([0, 1, 2, 3, 4].map((f) => burnVariant(fire, f))).toEqual(["fire0", "fire0", "fire1", "fire1", "fire2"]);
  });

  it("goes round all of them, for as long as it lasts", () => {
    expect(burnVariant(fire, 29)).toBe("fire14");
    expect(burnVariant(fire, 30)).toBe("fire0");
  });

  it("shows nothing on a fighter with no burn sheets", () => {
    expect(burnVariant([], 3)).toBeUndefined();
  });
});
