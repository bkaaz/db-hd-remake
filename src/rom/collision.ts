/**
 * A drawing's boxes, from the 32-byte record the game reads on every drawing
 * change: eight slots of x1 y1 x2 y2, signed and from the origin, an unused
 * slot starting with 0x80.
 *
 * What each slot is was read off the records rather than the code, so it is a
 * reading, not a fact: slots 2 and 3 hold the same rectangle exactly on the
 * drawings where the script fires its attack (far Y's fist, X's kick) and
 * nowhere else — the hit box; 6 and 7 cover the head and the body on every
 * drawing — the hurt boxes. Slot 0 is a narrow column at the feet on every
 * drawing (the push width, which our engine keeps as one number per fighter);
 * slot 1 a small box at the head, not used yet.
 */

import type { Box } from "../entity/entityFile";

const SLOTS: [number, Box["type"]][] = [
  [2, "hit"],
  [3, "hit"],
  [6, "hurt"],
  [7, "hurt"],
];

export function readBoxes(rom: Uint8Array, table: number, drawing: number): Box[] {
  const boxes: Box[] = [];
  for (const [slot, type] of SLOTS) {
    const at = table + 32 * drawing + 4 * slot;
    if (rom[at] === 0x80) continue;
    const [x1, y1, x2, y2] = [0, 1, 2, 3].map((i) => signed(rom[at + i]));
    const box = { type, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    if (!boxes.some((b) => b.type === box.type && b.x === box.x && b.y === box.y && b.w === box.w && b.h === box.h))
      boxes.push(box);
  }
  return boxes;
}

/** Slot 0's width: the column the fighter pushes with. */
export function pushWidth(rom: Uint8Array, table: number, drawing: number): number {
  const at = table + 32 * drawing;
  return signed(rom[at + 2]) - signed(rom[at]);
}

function signed(b: number): number {
  return b < 0x80 ? b : b - 0x100;
}
