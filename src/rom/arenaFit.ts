/**
 * How well an arena's layers explain a picture of the original's screen, and
 * where its camera must have stood: a screenshot says nothing about x, and a
 * wrong scroll speed shows as a match that no x can reach. Pure:
 * `scripts/arena-fit.ts` reads the files.
 */

import type { Rgba } from "../sprites/png";

export interface FitLayer {
  scroll: [number, number];
  image: Rgba;
}

export interface Fit {
  x: number;
  /** How far down the arena lies on the screen, in px. */
  y: number;
  /** The share of the compared pixels that agree. */
  share: number;
}

/** Under the original's HUD nothing can be compared. */
const FIRST_LINE = 36;
const CAMERA_XS = 256;
const OFFSETS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
/** The screenshot's 5-bit colours are stretched to 8 differently from ours. */
const SAME = 10;

function agreement(layers: FitLayer[], screen: Rgba, x: number, y: number): number {
  let [same, compared] = [0, 0];
  for (let line = FIRST_LINE; line < screen.height; line += 2) {
    for (let column = 0; column < screen.width; column += 2) {
      const at = (line * screen.width + column) * 4;
      let top: { data: Uint8Array; at: number } | null = null;
      for (const { scroll: [speed, offset], image } of layers) {
        const row = line - y;
        if (row < 0 || row >= image.height) continue;
        const i = (row * image.width + (Math.floor(x * speed) + offset + column) % image.width) * 4;
        if (image.data[i + 3]) top = { data: image.data, at: i };
      }
      if (!top) continue;
      compared++;
      if ([0, 1, 2].every((c) => Math.abs(top.data[top.at + c] - screen.data[at + c]) < SAME)) same++;
    }
  }
  return compared ? same / compared : 0;
}

/** The camera that explains `screen` best, its layers back to front. */
export function fitArena(layers: FitLayer[], screen: Rgba): Fit {
  let best: Fit = { x: 0, y: 0, share: -1 };
  for (let x = 0; x < CAMERA_XS; x++) {
    for (const y of OFFSETS) {
      const share = agreement(layers, screen, x, y);
      if (share > best.share) best = { x, y, share };
    }
  }
  return best;
}
