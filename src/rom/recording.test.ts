import { describe, expect, it } from "vitest";
import { fullestLife, readLives, readSnapshots, type Life } from "./recording";

// a shot (type a, animation 3) at x 100, y 200, vx 3.0 showing frames 0 then 1,
// which turns into an explosion (a/01) as a hitstop begins, frozen through it
const RECORDING = `# comments
f10 p1=9b p2=00 hit=00
  slot 0: 8a 03 00 00 00 00 64 00 00 c8 00 00 00 03 00 00
f12 p1=9b p2=00 hit=00
  slot 0: 8a 03 01 00 00 00 6a 00 00 c8 00 00 00 03 00 00
f14 p1=00 p2=00 hit=06
  slot 0: da 01 00 00 00 00 70 00 00 c8 00 00 00 00 00 00
f17 p1=00 p2=00 hit=00
  slot 0: 8a 01 01 00 00 00 70 00 00 c8 00 00 00 00 00 00
f19 p1=00 p2=00 hit=00
  slot 0: 0a 01 01 00 00 00 70 00 00 c8 00 00 00 00 00 00
`;

describe("readSnapshots", () => {
  it("reads a snapshot's frame, slot, slot bytes, VRAM, CGRAM and OAM in order", () => {
    const bin = new Uint8Array(4 + 1 + 16 + 0x10000 + 0x200 + 0x220);
    bin.set([0x10, 0x01, 0, 0, 3]);
    bin[5] = 0x8a;
    bin[21 + 0xc000] = 7;
    bin[21 + 0x10000] = 9;
    const [s] = readSnapshots(bin);
    expect([s.frame, s.slot, s.bytes[0], s.vram[0xc000], s.cgram[0], s.oam.length]).toEqual([0x110, 3, 0x8a, 7, 9, 0x220]);
  });
});

describe("readLives", () => {
  const [shot, burst] = readLives(RECORDING);

  it("reads a shot's frames and how long each was held, where it started and how fast it went", () => {
    expect(shot).toMatchObject({ slot: 0, type: 0x0a, anim: 0x03, from: 10, to: 14, x: 100, y: 200, vx: 3, vy: 0 });
    expect(shot.steps).toEqual([{ frame: 0, dur: 2 }, { frame: 1, dur: 2 }]);
  });

  it("says what the slot became as it went — the type its low nibble — and that a hitstop began then", () => {
    expect(shot.then).toEqual({ type: 0x0a, anim: 0x01 });
    expect(shot.hit).toBe(true);
  });

  it("does not count the frames it stood still through the hitstop", () => {
    expect(burst).toMatchObject({ anim: 0x01, from: 14, to: 19 });
    expect(burst.steps).toEqual([{ frame: 0, dur: 1 }, { frame: 1, dur: 2 }]);
  });
});

describe("fullestLife", () => {
  const life = (from: number, to: number, hit: boolean): Life =>
    ({ slot: 0, type: 1, anim: 4, from, to, steps: [], x: 0, y: 0, vx: 0, vy: 0, hit });

  it("takes the longest life that hit nothing, over a longer one cut by a hit", () => {
    const whole = life(100, 136, false);
    expect(fullestLife([life(0, 10, false), life(50, 90, true), whole], 1, 4)).toBe(whole);
  });

  it("takes the longest of all when every one hit, and nothing for an object never recorded", () => {
    const longest = life(50, 90, true);
    expect(fullestLife([life(0, 10, true), longest], 1, 4)).toBe(longest);
    expect(fullestLife([longest], 1, 3)).toBeUndefined();
  });
});
