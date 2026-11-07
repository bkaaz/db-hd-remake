/**
 * The journey's bands from the cartridge (`arena/bands.ts`): for each table,
 * a line's two windows ($2126–$2129, from `$01:8FD0`'s indirect HDMA lists),
 * drawn in the fixed colour where colour math lets it through and black where
 * not — inside the windows, or, turned inside out, outside them both.
 */

import { BAND_SCREEN, BAND_TABLES, bandScreen } from "../arena/bands";
import type { Rgba } from "../sprites/png";
import { toFile } from "./cartridge";

/** Each table's lines, leftward then rightward ($01:8E6D): 127 lines, then the rest 0x1FC on. */
const TABLES = { left: [0x019008, 0x019388, 0x019708, 0x019a88], right: [0x019e08, 0x01a188, 0x01a508, 0x01a888] };
const FIRST_BLOCK = 127;
const SECOND_BLOCK = 0x1fc;

/** The fixed colour the bands are, read off a screenshot: 6, 6, 15 of 31 `?`. */
const COLOUR = [6 << 3, 6 << 3, 15 << 3];

/** A line's two windows, each from its left edge to its right, inclusive; none where left passes right. */
export function windowsOf(rom: Uint8Array, table: number, line: number): [number, number][] {
  const at = toFile(line < FIRST_BLOCK ? table + 4 * line : table + SECOND_BLOCK + 4 * (line - FIRST_BLOCK))!;
  return [[rom[at], rom[at + 1]], [rom[at + 2], rom[at + 3]]];
}

/** Every screen of bands, stacked as `bandScreen` numbers them. */
export function bandsPicture(rom: Uint8Array): Rgba {
  const { width, height } = BAND_SCREEN;
  const data = new Uint8Array(width * height * BAND_TABLES * 4 * 4);
  for (const towardLeft of [true, false]) {
    for (let table = 0; table < BAND_TABLES; table++) {
      for (const insideOut of [false, true]) {
        const top = bandScreen(towardLeft, table, insideOut) * height;
        for (let y = 0; y < height; y++) {
          const windows = windowsOf(rom, (towardLeft ? TABLES.left : TABLES.right)[table], y);
          for (let x = 0; x < width; x++) {
            const inside = windows.some(([l, r]) => x >= l && x <= r);
            const lit = inside !== insideOut;
            data.set([...(lit ? COLOUR : [0, 0, 0]), 255], ((top + y) * width + x) * 4);
          }
        }
      }
    }
  }
  return { width, height: height * BAND_TABLES * 4, data };
}
