/**
 * A fighter's spoken lines (`a1`, `script.ts`): which his scripts speak, by
 * id — the sound test's recording holds each (`line_0d.wav`). A line is BRR
 * streamed to the chip from the ROM a frame at a time ($00:DA6F, `rom.md`),
 * not one of its samples.
 */

import { scriptAt, type FighterTables } from "./cartridge";
import { readScript } from "./script";

/** Every line a fighter's scripts speak (`a1`), once each, in id order. */
export function spokenLines(rom: Uint8Array, t: FighterTables): number[] {
  const ids = new Set<number>();
  for (let move = 0; move < 0x100; move++) {
    let ops;
    try {
      ops = readScript(rom, scriptAt(rom, t, move));
    } catch {
      continue; // a move with no script
    }
    for (const op of ops) if (op.op === "voice") ids.add(op.id);
  }
  return [...ids].sort((a, b) => a - b);
}

/** The bank id of line `id` and its file's stem: `line_0d`. */
export function lineName(id: number): string {
  return `line_${id.toString(16).padStart(2, "0")}`;
}

