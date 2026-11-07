/**
 * What the cartridge hands the sound chip, read as the chip receives it. The
 * game sends it with the boot ROM's own protocol (`$00:D914`): a chain of
 * blocks, each a 16-bit byte count, a 16-bit APU address and the bytes, until
 * a count of 0 whose address is where the chip starts running.
 *
 * At boot four are sent (`$00:9237`), by index into the 3-byte pointers at
 * `$00:DC30` (`$00:DE13`): the driver and the sounds every fight shares.
 */

import { toFile } from "./cartridge";

const UPLOADS = 0xdc30;

export interface ApuBlock {
  /** Where in the chip's 64 KB the bytes go. */
  at: number;
  bytes: Uint8Array;
}

export interface ApuUpload {
  blocks: ApuBlock[];
  /** Where the chip jumps when the chain ends. */
  start: number;
}

/** Upload `index` of the table at `$00:DC30`. */
export function apuUpload(rom: Uint8Array, index: number): ApuUpload {
  const at = toFile(UPLOADS)! + 3 * index;
  return readUpload(rom, rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16));
}

/** The chain at a CPU address, read byte by byte as `LDA [$00],Y` reaches it. */
export function readUpload(rom: Uint8Array, address: number): ApuUpload {
  let y = 0;
  const byte = (): number => {
    const off = toFile(address + y++);
    if (off === null) throw new Error(`upload runs off ROM at $${(address + y - 1).toString(16)}`);
    return rom[off];
  };
  const word = () => byte() | (byte() << 8);
  const blocks: ApuBlock[] = [];
  for (;;) {
    const count = word();
    const at = word();
    if (count === 0) return { blocks, start: at };
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) bytes[i] = byte();
    blocks.push({ at, bytes });
  }
}
