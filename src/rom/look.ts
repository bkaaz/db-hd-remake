/**
 * How a drawing is shown at one moment of a move: flipped and offset, as the
 * script's `e0` and `d0` leave it (src/rom/script.ts). The same drawing can be
 * shown several ways — the somersault is two drawings, turned and raised — so
 * each way it is shown becomes a frame of its own on the sheet, named so the
 * drawing it comes from stays readable: `11`, `11_hv`, `11_hv_0,-48`.
 */

import type { Box } from "../entity/entityFile";

export interface Look {
  h: boolean;
  v: boolean;
  /** Px from the fighter's position to where the drawing's origin is drawn. */
  dx: number;
  dy: number;
}

export const PLAIN: Look = { h: false, v: false, dx: 0, dy: 0 };

export function frameId(drawing: number, look: Look): string {
  const flip = look.h || look.v ? `_${look.h ? "h" : ""}${look.v ? "v" : ""}` : "";
  const offset = look.dx || look.dy ? `_${look.dx},${look.dy}` : "";
  return `${drawing}${flip}${offset}`;
}

export function parseFrameId(id: string): { drawing: number; look: Look } {
  const m = /^(\d+)(?:_([hv]+))?(?:_(-?\d+),(-?\d+))?$/.exec(id);
  if (!m) throw new Error(`"${id}" is not a frame of the cartridge's`);
  const flip = m[2] ?? "";
  return {
    drawing: Number(m[1]),
    look: { h: flip.includes("h"), v: flip.includes("v"), dx: Number(m[3] ?? 0), dy: Number(m[4] ?? 0) },
  };
}

/** A drawing's boxes where they end up: mirrored with it, then moved with it. */
export function placeBoxes(boxes: Box[], look: Look): Box[] {
  return boxes.map((b) => ({
    ...b,
    x: (look.h ? -(b.x + b.w) : b.x) + look.dx,
    y: (look.v ? -(b.y + b.h) : b.y) + look.dy,
  }));
}
