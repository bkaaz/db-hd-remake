import { describe, expect, it } from "vitest";
import { animName, blowStarts, moveAnim, moveAnims, toAnim } from "./animation";
import type { ScriptOp } from "./script";

const show = (frames: number, drawing: number | null): ScriptOp => ({ op: "show", frames, drawing });

describe("toAnim", () => {
  it("turns steps into frames held as long, leaving commands out", () => {
    const anim = toAnim([show(8, 0x46), { op: "sound", id: 6 }, show(4, 0x4a)]);
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

  it("gives each step its drawing's boxes", () => {
    const boxes = (d: number) => (d === 0x4a ? [{ type: "hit" as const, x: 21, y: -55, w: 28, h: 14 }] : []);
    expect(toAnim([show(8, 0x46), show(4, 0x4a)], boxes)?.steps).toEqual([
      { frame: "70", dur: 8 },
      { frame: "74", dur: 4, boxes: [{ type: "hit", x: 21, y: -55, w: 28, h: 14 }] },
    ]);
  });

  it("names the frame of a step shown flipped or offset, until the script resets it", () => {
    const anim = toAnim([
      { op: "offset", dx: 0, dy: -48 },
      show(4, 11),
      { op: "flip", h: true, v: true },
      show(4, 11),
      { op: "offset", dx: 0, dy: 0 },
      { op: "flip", h: false, v: false },
      show(4, 9),
    ]);
    expect(anim?.steps.map((s) => s.frame)).toEqual(["11_0,-48", "11_hv_0,-48", "9"]);
  });

  it("is null for a script that shows nothing", () => {
    expect(toAnim([show(4, null), { op: "sound", id: 1 }])).toBeNull();
  });
});

describe("moveAnim", () => {
  it("repeats idle, which the original replays, and not an attack", () => {
    const ops = [show(4, 1)];
    expect(moveAnim(0x00, ops)?.loop).toBe(true);
    expect(moveAnim(0x92, ops)?.loop).toBe(false);
  });

  it("ends the dash on the step the original holds, so it stays there", () => {
    const anim = moveAnim(0x0a, [show(8, 0x0d), show(8, 0x0e), show(8, 0x0d)]);
    expect(anim).toEqual({ loop: false, steps: [{ frame: "13", dur: 8 }, { frame: "14", dur: 8 }] });
  });
});

describe("moveAnims", () => {
  const spawn: ScriptOp = { op: "spawn", type: 0xa, anim: 3, tiles: 0, palette: 2, dx: 40, dy: -56 };

  it("cuts a move where it spawns mid-way, the second part named _2", () => {
    const anims = moveAnims(0x9b, [show(12, 0x63), spawn, show(44, 0x65)]);
    expect(Object.keys(anims)).toEqual(["m9b", "m9b_2"]);
    expect(anims.m9b.steps).toEqual([{ frame: "99", dur: 12 }]);
    expect(anims.m9b_2.steps).toEqual([{ frame: "101", dur: 44 }]);
  });

  it("starts a later part on the drawing, flip and offset the first left up", () => {
    const anims = moveAnims(0x9b, [{ op: "offset", dx: 0, dy: -8 }, show(4, 5), spawn, show(4, null)]);
    expect(anims.m9b_2.steps).toEqual([{ frame: "5_0,-8", dur: 4 }]);
  });

  it("cuts a multi-hit move where each blow after the first begins", () => {
    // Drawings 2 and 4 strike: two blows, named on from _2, as a spawn's parts are.
    const strike = (d: number) => (d === 2 || d === 4 ? [{ type: "hit" as const, x: 0, y: 0, w: 1, h: 1 }] : []);
    const ops = [show(4, 1), show(4, 2), show(4, 2), show(6, 3), show(6, 4)];
    expect(blowStarts(ops, strike)).toEqual([1, 4]);
    const anims = moveAnims(0xa5, ops, strike);
    expect(Object.keys(anims)).toEqual(["ma5", "ma5_2"]);
    expect(anims.ma5.steps.map((s) => s.frame)).toEqual(["1", "2", "2", "3"]);
    expect(anims.ma5_2.steps.map((s) => s.frame)).toEqual(["4"]);
  });

  it("keeps a move whole when it spawns before showing anything", () => {
    const anims = moveAnims(0x00, [spawn, show(12, 0), show(12, 1)]);
    expect(Object.keys(anims)).toEqual(["m00"]);
    expect(anims.m00.loop).toBe(true);
  });
});

describe("animName", () => {
  it("is m and the move id in two hex digits", () => {
    expect([animName(0x92), animName(5)]).toEqual(["m92", "m05"]);
  });
});
