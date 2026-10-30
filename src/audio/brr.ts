/**
 * The SNES sound chip's samples, read back from its RAM: a directory of
 * where each one starts and loops, and the BRR blocks they are made of.
 * Which sample a sound plays is the DSP's SRCN for its voice
 * (`tools/re/log-dsp.lua`); the RAM is `tools/re/dump-spc.lua`'s.
 *
 * A block is 9 bytes: a header — shift (bits 4–7), filter (2–3), loop (1),
 * end (0) — then 16 four-bit samples, high nibble first. Each is shifted,
 * halved and run through one of four filters on the two before it; the
 * arithmetic is the chip's, to the bit, as fullsnes gives it.
 *
 * Pure: bytes in, samples out. Build-time only.
 */

/** The sample rate the chip plays a sample at, at pitch 0x1000. */
export const NATIVE_RATE = 32000;

export interface SampleEntry {
  start: number;
  loop: number;
}

/** Sample `srcn`'s entry in the directory at `dir` × 0x100 (the DSP's $5D). */
export function sampleEntry(ram: Uint8Array, dir: number, srcn: number): SampleEntry {
  const at = (dir << 8) + 4 * srcn;
  return { start: ram[at] | (ram[at + 1] << 8), loop: ram[at + 2] | (ram[at + 3] << 8) };
}

const clamp16 = (v: number): number => Math.max(-32768, Math.min(32767, v));

/**
 * The sample starting at `start`, to its end block, as 16-bit values —
 * played once, without its loop. `limit` blocks at most, against a
 * directory entry that points at noise.
 */
export function decodeBrr(ram: Uint8Array, start: number, limit = 4096): Int16Array {
  const out: number[] = [];
  let [p1, p2] = [0, 0];
  let at = start;
  for (let block = 0; block < limit; block++) {
    const header = ram[at & 0xffff];
    const shift = header >> 4;
    const filter = (header >> 2) & 3;
    for (let i = 0; i < 16; i++) {
      const byte = ram[(at + 1 + (i >> 1)) & 0xffff];
      let s = i & 1 ? byte & 0x0f : byte >> 4;
      if (s >= 8) s -= 16;
      s = shift <= 12 ? (s << shift) >> 1 : s < 0 ? -2048 : 0;
      switch (filter) {
        case 1:
          s += p1 + (-p1 >> 4);
          break;
        case 2:
          s += 2 * p1 + (-3 * p1 >> 5) - p2 + (p2 >> 4);
          break;
        case 3:
          s += 2 * p1 + (-13 * p1 >> 6) - p2 + ((3 * p2) >> 4);
          break;
      }
      // clamped to 16 bits and kept doubled, wrapping; the filters read it halved
      const kept = (clamp16(s) << 17) >> 16;
      out.push(kept);
      [p2, p1] = [p1, kept >> 1];
    }
    if (header & 1) break;
    at += 9;
  }
  return Int16Array.from(out);
}

/**
 * A decoded sample played as the chip would, its pitch set once a frame
 * (`pitches`, 0x1000 = native), at `rate` Hz — until the sample or the
 * pitches run out. Nearest sample, no interpolation: enough to tell sounds
 * apart, not to listen to for pleasure.
 */
export function playAt(sample: Int16Array, pitches: number[], rate: number): Float32Array {
  const out: number[] = [];
  let pos = 0;
  for (const pitch of pitches) {
    const step = (NATIVE_RATE * pitch) / 0x1000 / rate;
    for (let i = 0; i < rate / 60 && pos < sample.length; i++, pos += step) out.push(sample[Math.floor(pos)] / 32768);
  }
  return Float32Array.from(out);
}
