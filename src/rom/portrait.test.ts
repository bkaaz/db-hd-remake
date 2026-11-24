import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH, toFile } from "./cartridge";
import { drawPortrait, PORTRAIT_WIDTH } from "./portrait";

/** An `lzss` stream of nothing but literals: the size, then a flag byte of ones before every eight. */
function literals(bytes: number[]): number[] {
  const out = [bytes.length & 0xff, bytes.length >> 8];
  bytes.forEach((b, i) => {
    if (i % 8 === 0) out.push(0xff);
    out.push(b);
  });
  return out;
}

describe("the after-fight portraits", () => {
  // character 1: tile 1 has its top-left pixel in colour 3, tile 10 (the second row's first) colour 1
  const tiles = new Array(0x1000 + 32 * 11).fill(0);
  tiles[0x1000 + 32 * 1] = 0x80;
  tiles[0x1000 + 32 * 1 + 1] = 0x80;
  tiles[0x1000 + 32 * 10] = 0x80;
  const rom = new Uint8Array(0x30000);
  rom.set(literals(tiles), toFile(0x058000)!);
  rom.set(literals([]), toFile(0x05acbc)!);
  rom.set(literals([]), toFile(0x05d42c)!);
  const colours = toFile(0x038140)! + 0x40;
  rom.set([0xff, 0x7f], colours + 2);
  rom.set([0x1f, 0x00], colours + 6);
  const at = (x: number, y: number, n = 1) => [...drawPortrait(rom, n).data.subarray((y * PORTRAIT_WIDTH + x) * 4, (y * PORTRAIT_WIDTH + x) * 4 + 4)];

  it("reads a character's tiles 0x1000 × his number in, from tile 1, nine across", () => {
    expect(at(0, 0)).toEqual([248, 0, 0, 255]);
    expect(at(0, 8)).toEqual([248, 248, 248, 255]);
    expect(at(0, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it("leaves colour 0 clear", () => {
    expect(at(1, 0)[3]).toBe(0);
  });
});

describe.skipIf(!existsSync(ROM_PATH))("the after-fight portraits, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  it("draws every fighter's, none of them empty", () => {
    for (let n = 0; n < 10; n++) {
      const { data } = drawPortrait(rom, n);
      const drawn = data.filter((_, i) => i % 4 === 3 && data[i] === 255).length;
      expect(drawn).toBeGreaterThan(3000);
    }
  });
});
