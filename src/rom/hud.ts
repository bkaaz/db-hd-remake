/**
 * The original's HUD ($00:C430): BG3, 2 bits a pixel, tiles from resource
 * 0x0F at VRAM $3000, a 32×32 map packed at $00:A441 for $3800, palette
 * record 0x0F from colour 0. `drawHud` draws the map as the loader leaves it,
 * for a person reading the cartridge; the game's HUD is ours (`src/hud/`).
 */

import type { Rgba } from "../sprites/png";
import { lzss } from "./lzss";
import { cpuPalette, cpuResource } from "./resource";

const TILES = 0x0f;
/** $00:A441, LoROM bank 0. */
const MAP = 0x2441;
const PALETTE = 0x0f;

interface Hud {
  tiles: Uint8Array;
  map: Uint8Array;
  colours: number[][];
}

function readHud(rom: Uint8Array): Hud {
  const cg = cpuPalette(rom, PALETTE);
  const colours = Array.from({ length: cg.length / 2 }, (_, i) => bgr(cg[2 * i] | (cg[2 * i + 1] << 8)));
  return { tiles: cpuResource(rom, TILES), map: lzss(rom, MAP), colours };
}

function bgr(c: number): number[] {
  return [(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3, 255];
}

function cell(hud: Hud, col: number, row: number): number {
  const at = 2 * (row * 32 + col);
  return hud.map[at] | (hud.map[at + 1] << 8);
}

/** Colour index of one pixel of 2bpp tile n: planes 0 and 1 interleaved, 16 bytes. */
function pixel2(tiles: Uint8Array, n: number, x: number, y: number): number {
  const t = 16 * n + 2 * y;
  const bit = 7 - x;
  return ((tiles[t] >> bit) & 1) | (((tiles[t + 1] >> bit) & 1) << 1);
}

/** One map entry's tile, in its palette and flips, at (x, y) of `img`; colour 0 left as it is. */
function drawTile(hud: Hud, entry: number, img: Rgba, x0: number, y0: number): void {
  const [tile, pal, h, v] = [entry & 0x3ff, (entry >> 10) & 7, entry & 0x4000, entry & 0x8000];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = pixel2(hud.tiles, tile, h ? 7 - x : x, v ? 7 - y : y);
      if (!i) continue;
      img.data.set(hud.colours[4 * pal + i], ((y0 + y) * img.width + x0 + x) * 4);
    }
  }
}

/** The whole map as the loader leaves it, for a person to look at. */
export function drawHud(rom: Uint8Array): Rgba {
  const hud = readHud(rom);
  const img = { width: 256, height: 256, data: new Uint8Array(256 * 256 * 4) };
  for (let row = 0; row < 32; row++) for (let col = 0; col < 32; col++) drawTile(hud, cell(hud, col, row), img, 8 * col, 8 * row);
  return img;
}
