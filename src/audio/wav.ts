/**
 * A rendered sound as a 16-bit stereo WAV file, for a person to listen to
 * (`npm run rom -- music`). The game never reads one back.
 */

import type { Rendered } from "../apu/effect";

export function encodeWav({ rate, left, right }: Rendered): Uint8Array {
  const data = left.length * 4;
  const out = new DataView(new ArrayBuffer(44 + data));
  const text = (at: number, s: string) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  out.setUint32(4, 36 + data, true);
  text(8, "WAVEfmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 2, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 4, true);
  out.setUint16(32, 4, true);
  out.setUint16(34, 16, true);
  text(36, "data");
  out.setUint32(40, data, true);
  const pcm = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v * 32768)));
  for (let i = 0; i < left.length; i++) {
    out.setInt16(44 + 4 * i, pcm(left[i]), true);
    out.setInt16(46 + 4 * i, pcm(right[i]), true);
  }
  return new Uint8Array(out.buffer);
}
