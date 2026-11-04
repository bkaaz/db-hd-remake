import { describe, expect, it } from "vitest";
import { ballStep, bubbleRadius, shadowFrame, type Ball, type SceneBallDef } from "./ball";

const DEF: SceneBallDef = {
  fx: "ball", shadow: "shadow", above: 40, bubble: { size: 8, frames: 80 }, shows: 40, falls: 82, gravity: 0.46875,
  floor: 188, bounce: -4, kick: { frame: 154, vy: -12 }, hang: 193, ricochet: { frame: 201, speed: 16 },
  shadowAt: [152, 176], burst: "burst", sound: "thud",
};
const LEFT = 255;
const start: Ball = { x: 495, y: 160, vx: 0, vy: 0, stage: "still", bounced: false };

function play(from: Ball, first: number, last: number): Ball {
  let b = from;
  for (let frame = first; frame <= last; frame++) b = ballStep(b, DEF, frame, 1, LEFT).ball;
  return b;
}

// logs/run-volleyball-hit.txt, the scene's frame 0 its f107
describe("ballStep, as the original's run shows it", () => {
  it("hangs, falls and bounces once: y 191 and vy −4 at f199", () => {
    const b = play(start, 0, 92);
    expect(Math.round(b.y)).toBe(191);
    expect(b.vy).toBe(-4);
  });

  it("comes to rest at 188, until it is kicked up at 12", () => {
    expect(play(start, 0, 153)).toMatchObject({ y: 188, vy: 0, stage: "still" });
    expect(Math.floor(play(start, 0, 155).y)).toBe(176);
  });

  it("stops in the air, and goes off forward into the wall: x 496, y 77 at f308", () => {
    const b = play(start, 0, 192);
    const stopped = ballStep(b, DEF, 193, 1, LEFT).ball;
    expect(stopped.vy).toBe(0);
    const away = ballStep({ ...stopped, y: 61 }, DEF, 201, 1, LEFT);
    expect(away).toMatchObject({ hit: true, ball: { x: 496, y: 77, vx: -16, vy: 16 } });
  });

  it("turns at each wall where the run does", () => {
    const r: Ball = { ...start, stage: "ricochet" };
    const step = (b: Partial<Ball>) => ballStep({ ...r, ...b }, DEF, 300, 1, LEFT);
    expect(step({ x: 272, y: 76, vx: -16, vy: -16 }).ball).toMatchObject({ x: 268, y: 60, vx: 16 });
    expect(step({ x: 492, y: 124, vx: 16, vy: -16 }).ball).toMatchObject({ x: 496, y: 108, vx: -16 });
    expect(step({ x: 284, y: 44, vx: 16, vy: -16 }).ball).toMatchObject({ y: 60, vy: 16 });
    expect(step({ x: 384, y: 189, vx: -16, vy: 16 }).ball).toMatchObject({ y: 172, vy: -16 });
    expect(step({ x: 400, y: 108, vx: 16, vy: 16 }).hit).toBe(false);
  });
});

describe("bubbleRadius", () => {
  it("grows from its size to 47 and back, then is gone", () => {
    expect([0, 39, 41, 73, 79, 80].map((f) => bubbleRadius(DEF, f))).toEqual([8, 47, 46, 14, 8, null]);
  });
});

describe("shadowFrame", () => {
  it("is smallest for a ball high up", () => {
    expect([100, 152, 175, 176].map((y) => shadowFrame(DEF, y))).toEqual([0, 1, 1, 2]);
  });
});
