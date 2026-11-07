/**
 * What the cartridge hands the sound chip, read as the chip receives it. The
 * game sends it with the boot ROM's own protocol (`$00:D914`): a chain of
 * blocks, each a 16-bit byte count, a 16-bit APU address and the bytes, until
 * a count of 0 whose address is where the chip starts running.
 *
 * At boot four are sent (`$00:9237`), by index into the 3-byte pointers at
 * `$00:DC30` (`$00:DE13`): the driver and the sounds every fight shares. A
 * fight then sends each fighter's voice (`$00:98EC`).
 */

import { toFile } from "./cartridge";

const UPLOADS = 0xdc30;
/** By character, 9 bytes: three pointers — player one's sample directory, player two's, the samples. */
const VOICES = 0xdd48;
/** Where each player's voice samples go: `$00:D980` sends every block there, whatever its own address. */
const VOICE_AT = [0x4000, 0x5600];

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

/** A fighter's voice as player `side` (0 or 1): his sample directory, then the samples. */
export function voiceUploads(rom: Uint8Array, character: number, side: 0 | 1): ApuUpload[] {
  const at = toFile(VOICES)! + 9 * character;
  const address = (n: number) => rom[at + 3 * n] | (rom[at + 3 * n + 1] << 8) | (rom[at + 3 * n + 2] << 16);
  const samples = readUpload(rom, address(2));
  return [readUpload(rom, address(side)), { ...samples, blocks: samples.blocks.map((b) => ({ ...b, at: VOICE_AT[side] })) }];
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
