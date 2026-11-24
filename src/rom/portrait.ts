import { toFile } from "./cartridge";
import { readPalette, tilePixel } from "./frame";
import { lzss } from "./lzss";
import type { Rgba } from "../sprites/png";

/**
 * The after-fight screen's portraits, as `$02:D40E` loads them: three packed
 * streams (`lzss`) unpacked one after another 0x4000 apart, a character's 100
 * tiles 0x1000 × his number in — tile 0 blank, 1 to 99 his picture, 9 tiles
 * across and 11 down, row by row. His colours are the first 16 of 64 bytes at
 * `$03:8140` + 0x40 × his number. The roster's order is the number (`roster.ts`).
 */

export const PORTRAIT_WIDTH = 72;
export const PORTRAIT_HEIGHT = 88;

const STREAMS = [0x058000, 0x05acbc, 0x05d42c];
const STREAM_ROOM = 0x4000;
const ONE = 0x1000;
const COLOURS = 0x038140;
const ACROSS = PORTRAIT_WIDTH / 8;

/** Every character's tiles, laid out as the screen's loader leaves them. */
export function portraitTiles(rom: Uint8Array): Uint8Array {
  const out = new Uint8Array(STREAMS.length * STREAM_ROOM);
  STREAMS.forEach((address, i) => out.set(lzss(rom, toFile(address)!).subarray(0, STREAM_ROOM), i * STREAM_ROOM));
  return out;
}

/** Character `n`'s portrait; colour 0, the screen's black behind it, left clear. */
export function drawPortrait(rom: Uint8Array, n: number, tiles = portraitTiles(rom)): Rgba {
  const own = tiles.subarray(n * ONE, (n + 1) * ONE);
  const colours = readPalette(rom, toFile(COLOURS)! + 0x40 * n);
  const data = new Uint8Array(PORTRAIT_WIDTH * PORTRAIT_HEIGHT * 4);
  for (let y = 0; y < PORTRAIT_HEIGHT; y++) {
    for (let x = 0; x < PORTRAIT_WIDTH; x++) {
      const tile = 1 + (y >> 3) * ACROSS + (x >> 3);
      const i = tilePixel(own, tile, x & 7, y & 7);
      if (i === 0) continue;
      data.set([...colours[i], 255], (y * PORTRAIT_WIDTH + x) * 4);
    }
  }
  return { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT, data };
}
