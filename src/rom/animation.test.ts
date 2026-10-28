import { describe, expect, it } from "vitest";
import { animName, toAnim } from "./animation";
import type { ScriptOp } from "./script";

const show = (frames: number, drawing: number | null): ScriptOp => ({ op: "show", frames, drawing });

describe("toAnim", () => {
  it("turns steps into frames held as long, leaving commands out", () => {
    const anim = toAnim([show(8, 0x46), { op: "attack", id: 6 }, show(4, 0x4a)]);
    expect(anim).toEqual({ loop: false, steps: [{ frame: "70", dur: 8 }, { frame: "74", dur: 4 }] });
  });

  it("shows the first pose during the frames before it, keeping the count", () => {
    expect(toAnim([show(2, null), show(8, 0x46)])?.steps).toEqual([
      { frame: "70", dur: 2 },
      { frame: "70", dur: 8 },
    ]);
  });

  it("repeats the step before for a keep in the middle", () => {
    expect(toAnim([show(3, 5), show(2, null), show(1, 6)])?.steps.map((s) => s.frame)).toEqual(["5", "5", "6"]);
  });

  it("gives a hold one frame, and drops a step of none", () => {
    expect(toAnim([show(0, 9), { op: "hold", drawing: 7 }])?.steps).toEqual([{ frame: "7", dur: 1 }]);
  });

  it("is null for a script that shows nothing", () => {
    expect(toAnim([show(4, null), { op: "attack", id: 1 }])).toBeNull();
  });
});

describe("animName", () => {
  it("is m and the move id in two hex digits", () => {
    expect([animName(0x92), animName(5)]).toEqual(["m92", "m05"]);
  });
});
