import { describe, expect, it } from "vitest";
import { kiBars } from "./ki";

describe("the HUD's ki bars", () => {
  it("fills a bar for each level full and part of the one filling", () => {
    expect(kiBars(0.5)).toEqual([1, 1, 1, 0, 0, 0]);
    expect(kiBars(0.25)).toEqual([1, 0.5, 0, 0, 0, 0]);
  });

  it("never lights past the ends", () => {
    expect(kiBars(1.2)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(kiBars(-0.1)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
