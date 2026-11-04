import { describe, expect, it } from "vitest";
import { moveRuns, objectsSeen } from "./fightLog";

const LOG = `# header
f1 hit=00 cam=1,2
  P1 00   0  0 d000 x 192 y 200 sy 200 vx  0.00 vy  0.00 face=00 hp=144 stun=20 f25=00 f96=00
  P2 00   0  0 d000 x 320 y 200 sy 200 vx  0.00 vy  0.00 face=40 hp=144 stun=20 f25=00 f96=00
  slot 0: c3 06 00 08 00 00 68 01 00 a8 00 01 00 00 00 00
f2 hit=00 cam=1,2
  P1 92   1  0 d00b x 192 y 200 sy 200 vx  0.00 vy  0.00 face=00 hp=144 stun=20 f25=00 f96=00
  P2 00   1  0 d000 x 320 y 200 sy 200 vx  0.00 vy  0.00 face=40 hp=120 stun=20 f25=00 f96=00
  slot 0: 8a 02 00 00 00 00 68 01 00 a8 00 01 00 00 00 00
f5 hit=88 cam=1,2
  P1 92   4  0 d00b x 212 y 190 sy 200 vx  2.00 vy  0.00 face=00 hp=144 stun=20 f25=00 f96=00
  P2 16   1  0 d000 x 320 y 200 sy 200 vx  0.00 vy  0.00 face=40 hp=120 stun=20 f25=00 f96=00
  slot 0: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
`;

describe("moveRuns", () => {
  it("joins the frames of a move, with where he went and what it cost", () => {
    expect(moveRuns(LOG, "P1")).toEqual([
      { move: "00", from: 1, to: 1, x: [192, 192], y: [200, 200], hp: [144, 144] },
      { move: "92", from: 2, to: 5, x: [192, 212], y: [200, 190], hp: [144, 144] },
    ]);
    expect(moveRuns(LOG, "P2")[0].hp).toEqual([144, 120]);
  });
});

describe("objectsSeen", () => {
  it("names an object by its type and animation, and what a slot's object becomes", () => {
    expect(objectsSeen(LOG)).toEqual([
      { frame: 1, slot: 0, kind: "03/06" },
      { frame: 2, slot: 0, kind: "0a/02" },
    ]);
  });
});
