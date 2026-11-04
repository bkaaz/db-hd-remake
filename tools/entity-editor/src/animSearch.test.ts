import { describe, expect, it } from "vitest";
import { matchingNames } from "./animSearch";

const names = ["m3c", "m30_gohan_9d", "m30_gohan_a9", "m30_goku_9d", "ma9"];

describe("matchingNames", () => {
  it("lists everything with nothing typed", () => {
    expect(matchingNames(names, "  ", null)).toEqual(names);
  });

  it("finds a part of a name, whatever its case", () => {
    expect(matchingNames(names, "GOHAN", null)).toEqual(["m30_gohan_9d", "m30_gohan_a9"]);
  });

  it("wants every word, in any order", () => {
    expect(matchingNames(names, "9d goku", null)).toEqual(["m30_goku_9d"]);
  });

  it("keeps the selected name in its place among the matches", () => {
    expect(matchingNames(names, "goku", "m3c")).toEqual(["m3c", "m30_goku_9d"]);
  });
});
