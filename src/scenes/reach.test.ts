import { describe, expect, it } from "vitest";
import { reachOf, widest } from "./reach";

const frames = new Map([
  ["0", { anchor: [20, 107] as [number, number], w: 48, h: 112 }],
  ["1", { anchor: [30, 100] as [number, number], w: 40, h: 120 }],
]);
const step = (frame: string) => ({ frame, dur: 1 });

describe("reachOf", () => {
  it("takes the farthest of every step, the wider side for both", () => {
    expect(reachOf({ loop: true, steps: [step("0"), step("1")] }, frames)).toEqual({ half: 30, up: 107, down: 20 });
  });

  it("passes over a step whose frame is missing", () => {
    expect(reachOf({ loop: true, steps: [step("9")] }, frames)).toEqual({ half: 0, up: 0, down: 0 });
  });
});

describe("widest", () => {
  it("holds each of them", () => {
    expect(widest([{ half: 30, up: 50, down: 2 }, { half: 10, up: 90, down: 5 }])).toEqual({ half: 30, up: 90, down: 5 });
  });
});
