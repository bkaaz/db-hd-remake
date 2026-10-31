import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { exportSpawns } from "./export";
import { readResource } from "./resource";

// Recorded on 2026-10-29: the ki blast alternated two frames every 2 frames
// and drew from resource 0x31, which a VRAM snapshot showed at $7500.
describe.skipIf(!existsSync(ROM_PATH))("objects, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads a fighter's tile set packed and the ki blast's tiles raw, each at its record's size", () => {
    expect(readResource(rom, 0x100).length).toBe(0x7e0); // Goku's tile set 0
    expect(readResource(rom, 0x31).length).toBe(0x600);
  });

  it("exports the ki blast as a spawn of two frames that hit, two frames each", () => {
    const ki = exportSpawns(rom, GOKU).ki_blast;
    expect(Object.keys(ki.frames)).toEqual(["0", "1"]);
    expect(ki.animations.play.steps.map((s) => s.dur)).toEqual([2, 2]);
    expect(ki.animations.play.steps.every((s) => s.boxes?.[0].type === "hit")).toBe(true);
  });

  it("exports the charged Kamehameha's three beam heads growing with the charge, and a base that comes in, loops and goes out without hitting", () => {
    const spawns = exportSpawns(rom, GOKU);
    const area = (name: string) => spawns[name].frames["0"].w * spawns[name].frames["0"].h;
    expect(area("kame_s")).toBeLessThan(area("kame_m"));
    expect(area("kame_m")).toBeLessThan(area("kame_l"));
    for (const size of ["s", "m", "l"]) {
      const steps = spawns[`kame_${size}`].animations.play.steps;
      expect(steps.map((s) => [s.dur, s.boxes?.[0]?.type])).toEqual([[4, "hit"], [4, "hit"]]);
    }
    const base = spawns.kame_base.animations;
    expect(Object.keys(base)).toEqual(["in", "loop", "out"]);
    expect([base.in.loop, base.loop.loop, base.out.loop]).toEqual([false, true, false]);
    expect(Object.values(base).every((a) => a.steps.every((s) => s.dur === 4 && !s.boxes))).toBe(true);
  });
});
