/**
 * The S-CPU's compression ($00:D7C8) — the stages' tiles, maps and palettes.
 * Not the SA-1's word-based one in `decompress.ts`: this one counts bytes.
 *
 *   u16 size              bytes of output, little-endian
 *   then a flag byte, read from bit 0 up, before every eight items:
 *   1                     copy the next byte
 *   0  lo hi              copy (lo & 0f) + 3 bytes from (lo >> 4 | hi << 4)
 *                         bytes back — may overlap what it is writing; what
 *                         would lie before the output's start reads as zero
 */

export function lzss(rom: Uint8Array, offset: number): Uint8Array {
  const size = rom[offset] | (rom[offset + 1] << 8);
  const out = new Uint8Array(size);
  let at = offset + 2;
  let n = 0;
  let flags = 0;
  let left = 0;
  while (n < size) {
    if (left === 0) {
      flags = rom[at++];
      left = 8;
    }
    const literal = flags & 1;
    flags >>= 1;
    left--;
    if (literal) {
      out[n++] = rom[at++];
      continue;
    }
    const lo = rom[at];
    const hi = rom[at + 1];
    at += 2;
    const count = (lo & 0x0f) + 3;
    const from = n - ((lo >> 4) | (hi << 4));
    // The game writes the whole copy even past `size`; nothing reads it.
    for (let i = 0; i < count && n < size; i++, n++) out[n] = from + i < 0 ? 0 : out[from + i];
  }
  return out;
}
