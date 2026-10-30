import { describe, expect, it } from "vitest";
import { copyOffset } from "./burst";

describe("an explosion's copy", () => {
  it("lands 4 to 11 px away, either side, never on top", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(copyOffset(i / 1000, [4, 11]));
    expect(Math.min(...[...seen].map(Math.abs))).toBe(4);
    expect(Math.max(...[...seen].map(Math.abs))).toBe(11);
    expect([...seen].some((v) => v < 0) && [...seen].some((v) => v > 0)).toBe(true);
  });
});
