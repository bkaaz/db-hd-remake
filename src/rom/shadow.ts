/**
 * The shadow a fighter's drawing casts on the floor, apart from the drawing: the
 * game adds it behind him as he is put in OAM ($00:8212). Many drawings have one
 * painted in instead, which stays with the body, so this is only for those the
 * cartridge lists. Mr. Buu, Cell and Freeza rely on it even standing.
 */

import { toFile } from "./cartridge";
import { readLayout, type Piece } from "./frame";
import { readResource } from "./resource";

/** `$00:82F6`: by character, a pointer into bank 0 to a bit per drawing. */
const CASTS = 0x0082f6;
/** `$09:B26E`: by character, a pointer into bank 9 to the layouts of its four sizes, 3 bytes each. */
const SIZES = 0x09b26e;
/** `$01:848B`: the resource each fighter keeps at `$6800`, whose tile 0 is OAM's `0x80`. */
const KEPT = 0x01848b;

export const SHADOW_SIZES = 4;

const file = (address: number): number => {
  const at = toFile(address);
  if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
  return at;
};
const word = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);

/** Whether the game adds a shadow to this drawing. */
export function castsShadow(rom: Uint8Array, character: number, drawing: number): boolean {
  const map = file(word(rom, file(CASTS) + 2 * character));
  return (rom[map + (drawing >> 3)] & (1 << (drawing & 7))) !== 0;
}

/** Its tiles, and the pieces of each size from widest to narrowest (`entity/shadow.ts` says which is shown). */
export function shadowDrawings(rom: Uint8Array, character: number): { tiles: Uint8Array; sizes: Piece[][] } {
  const table = file(0x090000 | word(rom, file(SIZES) + 2 * character));
  const sizes = Array.from({ length: SHADOW_SIZES }, (_, size) => {
    const at = table + 3 * size;
    return readLayout(rom, file(rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16)));
  });
  return { tiles: readResource(rom, word(rom, file(KEPT) + 2 * character)), sizes };
}
