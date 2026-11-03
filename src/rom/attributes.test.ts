import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { readAttributes, withAttributes } from "./attributes";
import { ROSTER } from "./roster";
import type { StatesFile } from "../entity/states";

describe.skipIf(!existsSync(ROM_PATH))("readAttributes, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads Goku's as his states and attributes.json have them", () => {
    const goku = readAttributes(rom, ROSTER.indexOf("goku"));
    const states = (JSON.parse(readFileSync("data/entities/goku/states.json", "utf8")) as StatesFile).states;
    const attributes = JSON.parse(readFileSync("data/entities/goku/attributes.json", "utf8"));
    expect(goku.defence).toBe(attributes.defence);
    expect(goku.gravity).toBeCloseTo(attributes.gravity, 2);
    expect([goku.walk[0], -goku.walk[1]]).toEqual([states.walk_fwd.vel![0], states.walk_back.vel![0]]);
    expect(goku.dash[0]).toBe(states.dash_fwd.vel![0]);
    expect(goku.jump).toBeCloseTo(-9.86, 2);
  });

  it("reads Vegeta's own: defence 10, a slower walk, a higher jump, more gravity", () => {
    const vegeta = readAttributes(rom, ROSTER.indexOf("vegeta"));
    expect(vegeta.defence).toBe(10);
    expect(vegeta.walk[0]).toBeCloseTo(1.398, 2);
    expect(vegeta.jump).toBeCloseTo(-10.75, 2);
    expect(vegeta.gravity).toBe(0.5);
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
      },
    } as unknown as StatesFile;
    const out = withAttributes(file, { defence: 10, walk: [1.4, 1.1], dash: [3.1, 3], jump: -10.75, gravity: 0.5 }).states;
    expect(out.walk_back.vel).toEqual([-1.1, 0]);
    expect(out.dash_fwd_run.vel).toEqual([3.1, 0]);
    expect(out.jump_fwd.air).toEqual([[2, { vx: 2.02, vy: -10.75 }]]);
    expect(file.states.walk_back.vel).toEqual([-1.25, 0]);
  });
});
