import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { readAttributes, withAttributes } from "./attributes";
import { ROSTER } from "./roster";
import type { StatesFile } from "../entity/states";

describe.skipIf(!existsSync(ROM_PATH))("readAttributes, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads Goku's: the jump at -9.86, forward 2.40 and back 2.02", () => {
    const goku = readAttributes(rom, ROSTER.indexOf("goku"));
    expect(goku.gravity).toBeCloseTo(0.469, 2);
    expect(goku.jump).toBeCloseTo(-9.86, 2);
    // forward 06 by the word at 9, back 07 by 0B ($0D:FC99)
    expect(goku.jumpVx[0]).toBeCloseTo(2.4, 2);
    expect(goku.jumpVx[1]).toBeCloseTo(2.02, 2);
  });

  it("reads Vegeta's own: defence 10, a slower walk, a higher jump, more gravity", () => {
    const vegeta = readAttributes(rom, ROSTER.indexOf("vegeta"));
    expect(vegeta.defence).toBe(10);
    expect(vegeta.walk[0]).toBeCloseTo(1.398, 2);
    expect(vegeta.jump).toBeCloseTo(-10.75, 2);
    expect(vegeta.gravity).toBe(0.5);
    expect(vegeta.jumpVx).toEqual([2.25, 1.798828125]);
  });
});

describe("withAttributes", () => {
  it("moves the template's walk, dash and jump onto his numbers, back as negative", () => {
    const file = {
      initial: "idle",
      states: {
        walk_back: { anim: "w", vel: [-1.25, 0] },
        dash_fwd_run: { anim: "d", vel: [3, 0] },
        jump_fwd: { anim: "j", air: [[2, { vx: 2.02, vy: -9.86 }]] },
        jump_back: { anim: "j", air: [[2, { vx: -2.02, vy: -9.86 }]] },
      },
    } as unknown as StatesFile;
    const out = withAttributes(file, { defence: 10, walk: [1.4, 1.1], dash: [3.1, 3], jump: -10.75, jumpVx: [2.25, 1.8], gravity: 0.5 }).states;
    expect(out.walk_back.vel).toEqual([-1.1, 0]);
    expect(out.dash_fwd_run.vel).toEqual([3.1, 0]);
    expect(out.jump_fwd.air).toEqual([[2, { vx: 2.25, vy: -10.75 }]]);
    expect(out.jump_back.air).toEqual([[2, { vx: -1.8, vy: -10.75 }]]);
    expect(file.states.walk_back.vel).toEqual([-1.25, 0]);
  });
});
