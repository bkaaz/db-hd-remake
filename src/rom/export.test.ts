import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { exportSpawns } from "./export";
import { draftedObjects } from "./draftObjects";
import { tablesOf } from "./fighterStates";
import { OWN_OBJECTS, ownObjects } from "./ownObjects";
import { readResource } from "./resource";

// Recorded on 2026-10-29: the ki blast alternated two frames every 2 frames
// and drew from resource 0x31, which a VRAM snapshot showed at $7500.
describe.skipIf(!existsSync(ROM_PATH))("objects, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads a fighter's tile set packed and the ki blast's tiles raw, each at its record's size", () => {
    expect(readResource(rom, 0x100).length).toBe(0x7e0); // Goku's tile set 0
    expect(readResource(rom, 0x31).length).toBe(0x600);
  });

  it("reads a tile set that unpacks past its record's size whole: Vegeta's 0x255, its drawing's sprays", () => {
    expect(readResource(rom, 0x255).length).toBe(0x900);
  });

  it("exports the ki blast as a spawn of two frames that hit, two frames each", () => {
    const ki = exportSpawns(rom, GOKU).ki_blast;
    expect(Object.keys(ki.frames)).toEqual(["0", "1"]);
    expect(ki.animations.play.steps.map((s) => s.dur)).toEqual([2, 2]);
    expect(ki.animations.play.steps.every((s) => s.boxes?.[0].type === "hit")).toBe(true);
  });

  it("exports idle's lightning with its dark stretch as an empty frame, then fourteen bolts, looped", () => {
    const crackle = exportSpawns(rom, GOKU).goku_crackle;
    const steps = crackle.animations.play.steps;
    expect(crackle.animations.play.loop).toBe(true);
    expect(steps.map((s) => s.dur)).toEqual([52, ...Array<number>(14).fill(4)]);
    expect([crackle.frames["14"].w, crackle.frames["14"].h]).toEqual([1, 1]);
    expect(crackle.frames["0"].w).toBeGreaterThan(1);
  });

  it("draws Vegetto's Big Bang flash upside down, up from where it is put, as his handler sets it", () => {
    const t = tablesOf(rom, "vegetto");
    const flash = draftedObjects("vegetto").filter((o) => o.name === "vegetto_4_02");
    const spawns = ownObjects(rom, t, flash, []);
    const { frames } = exportSpawns(rom, { ...t, objects: { loads: [], palettes: {}, spawns } }).vegetto_4_02;
    expect(frames["0"].anchor[1]).toBe(16);
  });

  it("draws an object in its thrower's palette once per lighting, as his own moves: Earth Stab's leg", () => {
    const t = tablesOf(rom, "buu");
    const leg = draftedObjects("buu").filter((o) => o.name === "buu_9_08");
    const { sheet, variants } = exportSpawns(rom, { ...t, objects: { loads: [], palettes: {}, spawns: ownObjects(rom, t, leg, []) } }).buu_9_08;
    expect(Object.keys(variants ?? {})).toEqual(["evening", "evening_alt", "night", "night_alt", "embers", "embers_alt", "alt"]);
    expect(Buffer.compare(Buffer.from(variants!.night.data), Buffer.from(sheet.data))).not.toBe(0);
  });

  it("relights the day's colours where the lighting's record is no ROM address: Goten's first fade by evening", () => {
    const t = tablesOf(rom, "gotenks");
    const goten = ownObjects(rom, t, OWN_OBJECTS.gotenks!.filter((o) => o.name === "gotenks_goten"), []);
    const { variants } = exportSpawns(rom, { ...t, objects: { loads: [], palettes: {}, spawns: goten } }).gotenks_goten;
    const [day, evening] = [variants!.shimmer1, variants!.evening_shimmer1];
    expect(evening).toBeDefined();
    expect(Buffer.compare(Buffer.from(evening.data), Buffer.from(day.data))).not.toBe(0);
  });

  it("exports the charged Kamehameha's three beam heads growing with the charge, and a base that comes in, loops and goes out without hitting", () => {
    const spawns = exportSpawns(rom, GOKU);
    const area = (name: string) => spawns[name].frames["0"].w * spawns[name].frames["0"].h;
    expect(area("kame_s")).toBeLessThan(area("kame_m"));
    expect(area("kame_m")).toBeLessThan(area("kame_l"));
    for (const size of ["s", "m", "l"]) {
      const steps = spawns[`kame_${size}`].animations.play.steps;
      // the large head strikes on its first frame alone: its second has no record ($2A:9AE3)
      expect(steps.map((s) => [s.dur, s.boxes?.[0]?.type])).toEqual([[4, "hit"], [4, size === "l" ? undefined : "hit"]]);
    }
    const base = spawns.kame_base.animations;
    expect(Object.keys(base)).toEqual(["in", "loop", "out"]);
    expect([base.in.loop, base.loop.loop, base.out.loop]).toEqual([false, true, false]);
    expect(Object.values(base).every((a) => a.steps.every((s) => s.dur === 4 && !s.boxes))).toBe(true);
  });
});
