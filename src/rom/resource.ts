/**
 * The cartridge's graphics resources: one table of 11-byte records at
 * 0x40000 ($08:8000, read by $00:B265), each a 3-byte pointer to tiles, the
 * tiles' size (low bits are flags), and a 3-byte pointer to a palette.
 * A fighter's tile set n is resource 0x100 + n.
 *
 * Nothing in the record has been seen to say whether the tiles are packed:
 * a stream that unpacks to exactly the record's size is taken as packed
 * (every fighter tile set), anything else as raw (the ki blast's 0x31).
 */

import { pointer } from "./cartridge";
import { decompress } from "./decompress";

const TABLE = 0x40000;
const RECORD = 11;

export function readResource(rom: Uint8Array, index: number): Uint8Array {
  const at = TABLE + RECORD * index;
  const tiles = pointer(rom, at);
  const size = (rom[at + 3] | (rom[at + 4] << 8)) & ~0x1f;
  try {
    const packed = decompress(rom, tiles).data;
    if (packed.length === size) return packed;
  } catch {
    // not a stream: raw tiles
  }
  return rom.subarray(tiles, tiles + size);
}

/** The ROM offset of a resource's palette: bytes 5–7 of its record. */
export function resourcePalette(rom: Uint8Array, index: number): number {
  return pointer(rom, TABLE + RECORD * index + 5);
}

/** The palettes: 5-byte records at $09:8000, read by $00:B2D6 — a pointer and a size. */
const PALETTES = 0x48000;

/** The ROM offset of palette record `id`'s first byte, and its size; a size of 0 means packed. */
export function paletteRecord(rom: Uint8Array, id: number): { at: number; size: number } {
  const rec = PALETTES + 5 * id;
  return { at: pointer(rom, rec), size: rom[rec + 3] | (rom[rec + 4] << 8) };
}

/** Where a resource is loaded in VRAM, in words — as the game's code puts it. */
export interface Load {
  resource: number;
  vram: number;
}

/**
 * OBJ VRAM as the game fills it, from $6000 (tile 0) to $7FFF (tile 0x1ff),
 * 32 bytes a tile — so an object's tile number indexes it directly.
 */
export function objectVram(rom: Uint8Array, loads: Load[]): Uint8Array {
  const vram = new Uint8Array(0x200 * 32);
  for (const { resource, vram: word } of loads) {
    const data = readResource(rom, resource);
    const at = (word - 0x6000) * 2;
    if (at < 0 || at + data.length > vram.length) throw new Error(`resource 0x${resource.toString(16)} does not fit at $${word.toString(16)}`);
    vram.set(data, at);
  }
  return vram;
}
