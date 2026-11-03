import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { drawingAtSpawn, spawnerLoads } from "./objectTiles";
import { fighterNamed } from "./roster";
import type { ScriptOp } from "./script";

const spawn = (anim: number): ScriptOp => ({ op: "spawn", counter: 0, type: 1, anim, tiles: 0, palette: 0, dx: 0, dy: 0, timer: 0, vx: 0, vy: 0 });

describe("drawingAtSpawn", () => {
  it("takes the drawing of the step after the spawn, not the one before it", () => {
    const ops: ScriptOp[] = [{ op: "show", frames: 4, drawing: 0x11 }, spawn(8), { op: "sound", id: 0x0b }, { op: "show", frames: 21, drawing: 0x7d }];
    expect(drawingAtSpawn(ops, 1, 8)).toBe(0x7d);
  });

  it("skips a step that keeps the drawing up, and says null when none follows", () => {
    expect(drawingAtSpawn([spawn(8), { op: "show", frames: 2, drawing: null }, { op: "show", frames: 2, drawing: 0x80 }], 1, 8)).toBe(0x80);
    expect(drawingAtSpawn([spawn(8)], 1, 8)).toBeNull();
  });
});

describe.skipIf(!existsSync(ROM_PATH))("spawnerLoads, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const vegeta = fighterNamed(rom, "vegeta");

  it("takes what the move loads: Big Bang's resource 4f at $6C00", () => {
    expect(spawnerLoads(rom, vegeta, 1, 4)).toEqual([{ resource: 0x4f, vram: 0x6c00 }]);
  });

  it("takes his sprite when the move loads nothing: Jumping Bomb's drawing 7d, Energy Dash's 80", () => {
    expect(spawnerLoads(rom, vegeta, 1, 8)).toEqual([{ resource: 0x255, vram: 0x6000 }]);
    expect(spawnerLoads(rom, vegeta, 1, 9)).toEqual([{ resource: 0x259, vram: 0x6000 }]);
  });

  it("says nothing for a move that loads nothing but draws past base 0: af's shots count on ae's load", () => {
    expect(spawnerLoads(rom, vegeta, 1, 0xe)).toEqual([]);
  });
});
