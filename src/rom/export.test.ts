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
    const ki = exportSpawns(rom, GOKU).goku_ki;
    expect(Object.keys(ki.frames)).toEqual(["0", "1"]);
    expect(ki.animations.play.steps.map((s) => s.dur)).toEqual([2, 2]);
    expect(ki.animations.play.steps.every((s) => s.boxes?.[0].type === "hit")).toBe(true);
  });
});
