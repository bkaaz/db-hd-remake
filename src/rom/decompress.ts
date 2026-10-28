/**
 * The cartridge's graphics compression, read back.
 *
 * A sprite's tiles sit in the ROM as one stream that the SA-1 unpacks into
 * BW-RAM before they are DMA'd to VRAM. Found by tracing which ROM bytes the
 * SA-1 reads while it fills that buffer (`tools/re/trace-tiles.lua`) and checked
 * byte for byte against the buffer the game built.
 *
 *   u16 size              bytes of output, little-endian
 *   then commands until `size` bytes are out; the unit is a 16-bit word:
 *   00-3f                 copy the next (c + 1) words
 *   40-7f n               repeat the next word (c & 3f) + 1 times
 *   80-ff count hi        copy (count + 1) words from ((c & 7f) | hi << 7) + 1
 *                         words back — may overlap what it is writing
 *
 * `hi` has been 0 in every stream decoded so far; reading it as the distance's
 * upper bits is a guess, and the only one that leaves the byte any use.
 *
 * A stream's last command may run past `size` (Goku's tile set 0x24 by one
 * word, and that stream still ends exactly where the next begins): the game
 * writes the spare word past its buffer, we drop it.
 */

export interface Unpacked {
  data: Uint8Array;
  /** Offset of the first byte after the stream. */
  end: number;
}

export function decompress(rom: Uint8Array, offset: number): Unpacked {
  const size = rom[offset] | (rom[offset + 1] << 8);
  const out = new Uint8Array(size);
  let src = offset + 2;
  let len = 0;

  const word = (from: number) => {
    if (len + 2 > size) return void (len += 2);
    out[len] = rom[from];
    out[len + 1] = rom[from + 1];
    len += 2;
  };

  while (len < size) {
    if (src >= rom.length) throw new Error(`stream at ${hex(offset)} runs off the ROM`);
    const c = rom[src++];
    if (c < 0x40) {
      for (let i = 0; i <= c; i++, src += 2) word(src);
    } else if (c < 0x80) {
      for (let i = 0; i <= (c & 0x3f); i++) word(src);
      src += 2;
    } else {
      const count = rom[src] + 1;
      const back = 2 * (((c & 0x7f) | (rom[src + 1] << 7)) + 1);
      src += 2;
      if (back > len) throw new Error(`stream at ${hex(offset)} refers before its start`);
      for (let i = 0; i < count; i++) {
        if (len + 2 > size) return { data: out, end: src };
        out[len] = out[len - back];
        out[len + 1] = out[len + 1 - back];
        len += 2;
      }
    }
  }
  return { data: out, end: src };
}

function hex(n: number): string {
  return "0x" + n.toString(16);
}
