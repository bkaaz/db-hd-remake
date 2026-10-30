/**
 * The original's HUD as its loader leaves it ($00:C430): BG3, 2 bits a
 * pixel, tiles from resource 0x0F at VRAM $3000, a 32×32 map packed at
 * $00:A441 for $3800, palette record 0x0F from colour 0. What the fight
 * writes into the map afterwards — names, numbers, bars — is not drawn.
 */

import type { Rgba } from "../sprites/png";
import { lzss } from "./lzss";
import { cpuPalette, cpuResource } from "./resource";

const TILES = 0x0f;
/** $00:A441, LoROM bank 0. */
const MAP = 0x2441;
const PALETTE = 0x0f;

/** Colour index of one pixel of 2bpp tile n: planes 0 and 1 interleaved, 16 bytes. */
function pixel2(tiles: Uint8Array, n: number, x: number, y: number): number {
  const t = 16 * n + 2 * y;
  const bit = 7 - x;
  return ((tiles[t] >> bit) & 1) | (((tiles[t + 1] >> bit) & 1) << 1);
}

export function drawHud(rom: Uint8Array): Rgba {
  const tiles = cpuResource(rom, TILES);
  const map = lzss(rom, MAP);
  const cg = cpuPalette(rom, PALETTE);
  const colour = (i: number): number[] => {
    const c = cg[2 * i] | (cg[2 * i + 1] << 8);
    return [(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3, 255];
  };
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let ty = 0; ty < 32; ty++) {
    for (let tx = 0; tx < 32; tx++) {
      const e = map[2 * (ty * 32 + tx)] | (map[2 * (ty * 32 + tx) + 1] << 8);
      const [tile, pal, h, v] = [e & 0x3ff, (e >> 10) & 7, e & 0x4000, e & 0x8000];
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const i = pixel2(tiles, tile, h ? 7 - x : x, v ? 7 - y : y);
          if (i) data.set(colour(4 * pal + i), ((ty * 8 + y) * size + tx * 8 + x) * 4);
        }
      }
    }
  }
  return { width: size, height: size, data };
}
