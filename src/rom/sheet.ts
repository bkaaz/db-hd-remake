/**
 * Lay drawings out on one sheet, in the shape `frames.json` describes.
 *
 * Unlike the hand-built `goku_old.png`, this sheet is a build product: it is
 * rewritten whole from the cartridge every time, so rows are packed afresh
 * and nothing depends on where a drawing landed last time.
 */

import type { FrameDef } from "../entity/entityFile";
import type { Rgba } from "../sprites/png";

export interface Placed {
  id: string;
  image: Rgba;
  /** The fighter's origin inside `image` — becomes the frame's anchor. */
  origin: { x: number; y: number };
}

/** Rows left to right in the order given, a new row when one would overflow. */
export function packSheet(items: Placed[], maxWidth = 1024, gap = 2): { sheet: Rgba; frames: Record<string, FrameDef> } {
  const frames: Record<string, FrameDef> = {};
  let x = gap;
  let y = gap;
  let rowHeight = 0;
  let width = 0;
  for (const { id, image, origin } of items) {
    if (image.width + 2 * gap > maxWidth) throw new Error(`drawing ${id} is wider than the sheet`);
    if (x + image.width + gap > maxWidth) {
      x = gap;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    frames[id] = { x, y, w: image.width, h: image.height, anchor: [origin.x, origin.y] };
    x += image.width + gap;
    width = Math.max(width, x);
    rowHeight = Math.max(rowHeight, image.height);
  }
  const height = y + rowHeight + gap;

  const data = new Uint8Array(width * height * 4);
  for (const { id, image } of items) {
    const f = frames[id];
    for (let row = 0; row < image.height; row++) {
      const from = row * image.width * 4;
      data.set(image.data.subarray(from, from + image.width * 4), ((f.y + row) * width + f.x) * 4);
    }
  }
  return { sheet: { width, height, data }, frames };
}
