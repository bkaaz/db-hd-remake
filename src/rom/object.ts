/**
 * The object system — what a script's `b0` starts (src/rom/script.ts): ki
 * blasts, sparks, the transformation's hair. An object's type and animation
 * pick a list of frames; each frame is a layout like a fighter's, drawn from
 * tiles already in VRAM (src/rom/resource.ts).
 *
 * How long each frame stays up, and how the object moves, is in its type's
 * own code in bank $0F, not in data — read off a recording
 * (tools/re/log-objects.lua) beside the fighter that spawns it.
 */

import { pointer, toFile } from "./cartridge";

/** Word pointers by type to its animations, each a word pointer to frames; all in bank $09. */
const TYPES = 0x4b258;
const BANK = 0x09;

function word(rom: Uint8Array, at: number): number {
  return rom[at] | (rom[at + 1] << 8);
}

/** Offset of the layout an object of `type` shows at `step` of `anim`. */
export function objectFrame(rom: Uint8Array, type: number, anim: number, step: number): number {
  const inBank = (addr: number) => {
    const off = toFile((BANK << 16) | addr);
    if (off === null) throw new Error(`object ${type}/${anim}: $${addr.toString(16)} is not ROM`);
    return off;
  };
  const anims = inBank(word(rom, TYPES + 2 * type));
  const frames = inBank(word(rom, anims + 2 * anim));
  return pointer(rom, frames + 3 * step);
}
