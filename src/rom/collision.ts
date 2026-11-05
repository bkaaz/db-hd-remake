/**
 * A drawing's boxes, from the 32-byte record the game reads on every drawing
 * change: eight slots of x1 y1 x2 y2, signed and from the origin, an unused
 * slot starting with 0x80.
 *
 * What each slot is was read off the records rather than the code, so it is a
 * reading, not a fact: slots 2 and 3 hold the same rectangle exactly on the
 * drawings where the script plays its swing (far Y's fist, X's kick) and
 * nowhere else — the hit box; 6 and 7 cover the head and the body on every
 * drawing — the hurt boxes. Slots 0 and 1 are read by the code: the body and
 * the head the two fighters push each other with ($2A:80ED, docs/rom.md).
 */

import type { Box } from "../entity/entityFile";
import { toFile } from "./cartridge";

const SLOTS: [number, Box["type"]][] = [
  [0, "push"],
  [1, "push"],
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

/** Slot 0's width: the body a fighter pushes with, as the one number `attributes.json` keeps. */
export function pushWidth(rom: Uint8Array, table: number, drawing: number): number {
  const at = table + 32 * drawing;
  return signed(rom[at + 2]) - signed(rom[at]);
}

function signed(b: number): number {
  return b < 0x80 ? b : b - 0x100;
}

/** `$2A:9AE3`, read by `$2A:88F6`: by an object's type, its animation, its frame shown: x1 y1 x2 y2, 0x80 first for none. */
const OBJECT_BOXES = 0x2a9ae3;

/**
 * What an object hits with on a frame, from its place and facing, or null for
 * nothing on that frame. An object's blow is not its picture: Kienzan's disc
 * reaches further than it is drawn, and many draw far past where they strike.
 */
export function objectBox(rom: Uint8Array, type: number, anim: number, frame: number): Box | null {
  const inBank = (p: number) => toFile(0x2a0000 | p);
  const word = (at: number | null) => (at === null ? 0 : rom[at] | (rom[at + 1] << 8));
  const table = word((toFile(OBJECT_BOXES) ?? 0) + 2 * type);
  if (table === 0) return null;
  const frames = word((inBank(table) ?? 0) + 2 * anim);
  if (frames === 0) return null;
  const record = word((inBank(frames) ?? 0) + 2 * frame);
  const at = inBank(record);
  if (record === 0 || at === null || rom[at] === 0x80) return null;
  const [x1, y1, x2, y2] = [0, 1, 2, 3].map((i) => signed(rom[at + i]));
  return { type: "hit", x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
