/**
 * A drawing dissolving into a lattice of pixels, as the SNES shows a body
 * thinning out instead of fading it — the cartridge's own teleport draws its
 * frames so (Goku's `44`, `43`). Ordered by a 4×4 Bayer matrix, in the
 * drawing's own pixels, so it holds still as the body moves. Pure: which
 * pixels stay; `dissolve.ts` draws it.
 */

/** Levels of a dissolve: all its pixels at the top, none at 0. */
export const DITHER_LEVELS = 16;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** Whether the pixel at `x`, `y` of a drawing is still there at `level` of `DITHER_LEVELS`. */
export function ditherKeeps(level: number, x: number, y: number): boolean {
  return BAYER[y & 3][x & 3] < level;
}
