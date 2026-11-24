import { describe, expect, it } from "vitest";
import { kiMarks } from "./ki";

describe("the HUD's ki marks", () => {
  it("lights a mark for each level full and part of the one filling", () => {
    expect(kiMarks(0.5)).toEqual([1, 1, 1, 0, 0, 0]);
    expect(kiMarks(0.25)).toEqual([1, 0.5, 0, 0, 0, 0]);
  });

  it("never lights past the ends", () => {
    expect(kiMarks(1.2)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(kiMarks(-0.1)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
