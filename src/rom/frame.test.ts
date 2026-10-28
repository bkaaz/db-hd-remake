import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH, layoutAt, pointer } from "./cartridge";
import { drawFrame, flipLayout, readLayout, tilePixel, type Piece } from "./frame";

describe("readLayout", () => {
  it("reads signed offsets, the tile and the size bit, up to 0x80", () => {
    const rom = Uint8Array.from([0x12, 0xf8, 0x2f, 0x00, 0xfb, 0xe8, 0x0e, 0x10, 0x80, 0x99]);
    expect(readLayout(rom, 0)).toEqual([
      { dx: 18, dy: -8, tile: 0x2f, big: false, hflip: false, vflip: false },
      { dx: -5, dy: -24, tile: 0x0e, big: true, hflip: false, vflip: false },
    ]);
  });

  it("reads OAM's flip bits", () => {
    expect(readLayout(Uint8Array.from([0, 0, 0, 0x40, 0, 0, 0, 0x80, 0x80]), 0)).toMatchObject([
      { hflip: true, vflip: false },
      { hflip: false, vflip: true },
    ]);
  });

  it("refuses an attribute it does not know how to draw", () => {
    expect(() => readLayout(Uint8Array.from([0, 0, 0, 0x01, 0x80]), 0)).toThrow(/unknown attribute/);
  });
});

/** A tile set where tile n is filled with colour index (n % 13) + 1: n, n+1, n+16, n+17 all differ. */
function solidTiles(count: number): Uint8Array {
  const tiles = new Uint8Array(32 * count);
  for (let n = 0; n < count; n++) {
    const v = (n % 13) + 1;
    for (let y = 0; y < 8; y++) {
      for (let plane = 0; plane < 4; plane++) {
        const at = 32 * n + (plane < 2 ? 2 * y + plane : 16 + 2 * y + plane - 2);
        tiles[at] = (v >> plane) & 1 ? 0xff : 0;
      }
    }
  }
  return tiles;
}

/** Palette whose colour i is (i, 0, 0), so a pixel says which index it came from. */
const RAMP = Array.from({ length: 16 }, (_, i) => [i, 0, 0] as [number, number, number]);

describe("flipLayout", () => {
  const piece = (dx: number, dy: number, big: boolean): Piece => ({ dx, dy, tile: 0, big, hflip: false, vflip: false });

  it("mirrors each piece about the origin, by its own size", () => {
    expect(flipLayout([piece(2, -8, false), piece(4, -16, true)], true, false)).toMatchObject([
      { dx: -10, dy: -8, hflip: true, vflip: false },
      { dx: -20, dy: -16, hflip: true, vflip: false },
    ]);
    expect(flipLayout([piece(2, -8, false)], false, true)).toMatchObject([{ dx: 2, dy: 0, vflip: true }]);
  });

  it("undoes a piece's own flip rather than stacking it", () => {
    expect(flipLayout([{ ...piece(0, 0, false), hflip: true }], true, false)[0].hflip).toBe(false);
  });
});

describe("tilePixel", () => {
  it("takes planes 0/1 from the first 16 bytes and 2/3 from the second", () => {
    const tiles = new Uint8Array(32);
    tiles[0] = 0x80; // row 0, plane 0, leftmost pixel
    tiles[17] = 0x80; // row 0, plane 3
    expect(tilePixel(tiles, 0, 0, 0)).toBe(0b1001);
    expect(tilePixel(tiles, 0, 1, 0)).toBe(0);
  });
});

describe("drawFrame", () => {
  const red = (d: ReturnType<typeof drawFrame>, x: number, y: number) =>
    d.image.data[(y * d.image.width + x) * 4];

  it("builds a 16x16 piece from tiles n, n+1, n+16 and n+17", () => {
    const d = drawFrame(solidTiles(32), [{ dx: 0, dy: 0, tile: 2, big: true, hflip: false, vflip: false }], RAMP);
    expect([red(d, 0, 0), red(d, 8, 0), red(d, 0, 8), red(d, 8, 8)]).toEqual([3, 4, 6, 7]);
  });

  it("flips a 16x16 piece as a whole: its tiles trade places", () => {
    const big = { dx: 0, dy: 0, tile: 2, big: true };
    const h = drawFrame(solidTiles(32), [{ ...big, hflip: true, vflip: false }], RAMP);
    expect([red(h, 0, 0), red(h, 8, 0), red(h, 0, 8), red(h, 8, 8)]).toEqual([4, 3, 7, 6]);
    const v = drawFrame(solidTiles(32), [{ ...big, hflip: false, vflip: true }], RAMP);
    expect([red(v, 0, 0), red(v, 8, 0), red(v, 0, 8), red(v, 8, 8)]).toEqual([6, 7, 3, 4]);
  });

  it("mirrors the pixels inside a flipped tile", () => {
    const tiles = new Uint8Array(32);
    tiles[0] = 0x80; // row 0: only the leftmost pixel, colour 1
    const d = drawFrame(tiles, [{ dx: 0, dy: 0, tile: 0, big: false, hflip: true, vflip: false }], RAMP);
    expect([red(d, 0, 0), red(d, 7, 0)]).toEqual([0, 1]);
  });

  it("places the origin where offsets count from, and draws the first piece on top", () => {
    const pieces: Piece[] = [
      { dx: -4, dy: -8, tile: 1, big: false, hflip: false, vflip: false },
      { dx: 0, dy: -8, tile: 5, big: false, hflip: false, vflip: false },
    ];
    const d = drawFrame(solidTiles(8), pieces, RAMP);
    expect(d.origin).toEqual({ x: 4, y: 8 });
    expect(d.image.width).toBe(12);
    expect(red(d, 6, 0)).toBe(2); // overlap: the first piece wins
    expect(red(d, 10, 0)).toBe(6);
  });
});

// The pieces the game put in OAM for drawing 46, recorded in Mesen on 2026-10-28.
describe.skipIf(!existsSync(ROM_PATH))("readLayout, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads Goku's drawing 46 as the game laid it out", () => {
    const pieces = readLayout(rom, pointer(rom, layoutAt(GOKU, 0x46)));
    expect(pieces).toHaveLength(24);
    expect(pieces[0]).toMatchObject({ dx: 18, dy: -8, tile: 0x2f, big: false });
    expect(pieces[16]).toMatchObject({ dx: -5, dy: -24, tile: 0x0e, big: true });
  });
});
