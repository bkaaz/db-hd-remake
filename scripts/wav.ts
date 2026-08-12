/**
 * Minimal WAV read/write — 16-bit PCM only, which is what the browser recorder
 * in `docs/audio-capture.md` produces and all we ever need to write.
 *
 * No dependency, for the same reason as `scripts/png.ts`: the format we handle
 * is one we also generate, so it is a few dozen lines and it refuses anything
 * unexpected loudly instead of misreading it.
 */

export interface Wave {
  sampleRate: number;
  /** Mono, −1..1. Stereo input is mixed down on read. */
  samples: Float32Array;
}

export function decodeWav(buf: Buffer): Wave {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("not a RIFF/WAVE file");
  }

  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  let data: Buffer | null = null;

  let at = 12;
  while (at + 8 <= buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === "fmt ") {
      const format = buf.readUInt16LE(body);
      if (format !== 1) throw new Error(`only uncompressed PCM is supported (format ${format})`);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === "data") {
      data = buf.subarray(body, body + size);
    }
    at = body + size + (size % 2); // chunks are word-aligned
  }

  if (!data || !sampleRate || !channels) throw new Error("missing fmt or data chunk");
  if (bits !== 16) throw new Error(`only 16-bit PCM is supported (got ${bits}-bit)`);

  const frames = Math.floor(data.length / 2 / channels);
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += data.readInt16LE((i * channels + c) * 2) / 32768;
    samples[i] = sum / channels;
  }
  return { sampleRate, samples };
}

export function encodeWav({ sampleRate, samples }: Wave): Buffer {
  const bytes = samples.length * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + bytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(bytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}
