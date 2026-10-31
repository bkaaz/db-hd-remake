/**
 * A fighter's spoken lines (`a1`, `script.ts`), read out of the cartridge:
 * they are not the sound chip's samples but BRR streamed to it from the ROM
 * a frame at a time ($00:DA6F), so they can be decoded here whole — the
 * voice of every fighter without anyone listening for which clip is which.
 */

import { decodeBrr } from "../audio/brr";
import { pointer, scriptAt, toFile, type FighterTables } from "./cartridge";
import { readScript } from "./script";

/** 3-byte pointers by line id, $00:DB98 ($00:DB61). */
const LINES = toFile(0x00db98)!;
/** A BRR block: a header and 16 samples in 8 bytes. */
const BLOCK = 9;

/**
 * The rate a line plays at: 75 bytes a frame ($067A) of 9-byte blocks of 16
 * samples, at 60 frames a second — line 0 lasts what the capture's clip does.
 */
export const LINE_RATE = (60 * 75 * 16) / BLOCK;

/**
 * Line `id`'s BRR, chunk by chunk: each a byte count and that many bytes
 * sent to the chip at $3700, until a count of 0. A chunk's last block ends
 * it, as a sample of its own.
 */
export function lineChunks(rom: Uint8Array, id: number): Uint8Array[] {
  let at = pointer(rom, LINES + 3 * id);
  const chunks: Uint8Array[] = [];
  for (let n = word(rom, at); n !== 0; n = word(rom, at)) {
    chunks.push(rom.subarray(at + 2, at + 2 + n));
    at += 2 + n;
  }
  return chunks;
}

/** Line `id` as sound, −1..1 at `LINE_RATE`: its chunks one after another. */
export function decodeLine(rom: Uint8Array, id: number): Float32Array {
  const pcm = lineChunks(rom, id).flatMap((c) => [...decodeBrr(c, 0, c.length / BLOCK)]);
  return Float32Array.from(pcm, (s) => s / 32768);
}

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

function word(rom: Uint8Array, at: number): number {
  return rom[at] | (rom[at + 1] << 8);
}
