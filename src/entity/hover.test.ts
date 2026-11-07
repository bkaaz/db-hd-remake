import { describe, expect, it } from "vitest";
import { hoverOffset, quiverOffset, soundsOn } from "./hover";

describe("soundsOn", () => {
  it("gives what is due on its frame and nothing between", () => {
    const at: [number, string][] = [[8, "swing"], [8, "voice"], [12, "swing"]];
    expect(soundsOn(at, 8)).toEqual(["swing", "voice"]);
    expect(soundsOn(at, 9)).toEqual([]);
    expect(soundsOn(undefined, 8)).toEqual([]);
  });
});

describe("hoverOffset", () => {
  it("rises a pixel every 4 frames to 6 up, then sinks back, 48 frames round", () => {
    const path = Array.from({ length: 48 }, (_, f) => hoverOffset(f));
    expect(path.slice(0, 5)).toEqual([0, 0, 0, -1, -1]);
    expect(Math.min(...path)).toBe(-6);
    expect(path[47]).toBe(0);
    expect(hoverOffset(48)).toBe(hoverOffset(0));
  });
});

describe("quiverOffset", () => {
  it("draws a pixel back every other frame, up to its frame", () => {
    expect([0, 1, 2, 3].map((f) => quiverOffset(f, 4))).toEqual([0, -1, 0, -1]);
    expect(quiverOffset(5, 4)).toBe(0);
    expect(quiverOffset(1, undefined)).toBe(0);
  });
});
