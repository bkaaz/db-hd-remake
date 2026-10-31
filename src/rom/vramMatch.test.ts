import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { objectVram } from "./resource";
import { findPalette, matchLoads } from "./vramMatch";

describe.skipIf(!existsSync(ROM_PATH))("matching a snapshot to the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("finds the resources laid in OBJ VRAM where they lie: Goku's ki blast and hair", () => {
    const obj = objectVram(rom, GOKU.objects.loads);
    const found = matchLoads(rom, obj, [...Array(0x100).keys()]);
    expect(found).toEqual(expect.arrayContaining([{ resource: 0x31, vram: 0x7500 }, { resource: 0x51, vram: 0x6c00 }]));
  });

  it("finds a palette by its colours: the ki blast's", () => {
    const colours = rom.subarray(0x27b161, 0x27b161 + 32);
    expect(findPalette(rom, new Uint8Array(colours))).toContain(0x27b161);
  });
});
