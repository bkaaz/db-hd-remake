import { describe, expect, it } from "vitest";
import { trailAt } from "./trail";

const beats = (trail: Parameters<typeof trailAt>[0], frames: number): number[] =>
  Array.from({ length: frames }, (_, f) => f).filter((f) => trailAt(trail, f));

describe("trailAt", () => {
  it("puts one out every `every` frames, from `from` to `to`", () => {
    // Double Punch's first part: frames 1–31, every 4th
    expect(beats({ fx: "dust", every: 4, from: 1, to: 31 }, 40)).toEqual([1, 5, 9, 13, 17, 21, 25, 29]);
  });

  it("runs from the state's first frame to its last when neither end is named", () => {
    expect(beats({ fx: "dust", every: 3 }, 10)).toEqual([0, 3, 6, 9]);
  });

  it("puts nothing out for a state without one", () => {
    expect(beats(undefined, 10)).toEqual([]);
  });
});
