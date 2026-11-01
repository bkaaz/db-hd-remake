import { NATIVE_RATE } from "./brr";

/**
 * A sound the chip made, made again from its own sample and what the
 * recording says its voices did each frame (`tools/re/log-dsp.lua`) — for a
 * sound no clip of the capture holds, Saiyan Meteor's ball among them. Pure;
 * build-time only (`npm run samples -- --render`).
 */

/** A frame of a voice: pitch (0x1000 = native), envelope (0–127), and whether the sample starts again from its top. */
export interface VoiceFrame {
  pitch: number;
  env: number;
  key?: boolean;
}

/** One voice's frames, one each. */
export interface VoiceTrack {
  sample: Int16Array;
  /** Where the sample loops back to when it runs out, in samples; null plays it once. */
  loopAt: number | null;
  frames: VoiceFrame[];
}

/**
 * Where a sample loops, in samples, from its directory entry: its loop
 * address as a block from its start — or null when its end block does not
 * loop (header bit 1) or the address is outside it.
 */
export function loopIndex(ram: Uint8Array, start: number, loop: number, length: number): number | null {
  const blocks = length / 16;
  const end = start + 9 * (blocks - 1);
  if (!(ram[end & 0xffff] & 2)) return null;
  const block = (loop - start) / 9;
  return Number.isInteger(block) && block >= 0 && block < blocks ? block * 16 : null;
}

/** The voices mixed at `rate` Hz, a frame being 1/60 s; each read with linear interpolation, its pitch and envelope held across the frame. */
export function renderVoices(voices: readonly VoiceTrack[], rate: number): Float32Array {
  const perFrame = rate / 60;
  const length = Math.ceil(Math.max(0, ...voices.map((v) => v.frames.length)) * perFrame);
  const out = new Float32Array(length);
  for (const v of voices) {
    let pos = 0;
    v.frames.forEach(({ pitch, env, key }, f) => {
      if (key) pos = 0;
      const step = (NATIVE_RATE * pitch) / 0x1000 / rate;
      const gain = env / 127;
      // the frame's samples counted from the start, so 533⅓ a frame does not drift
      const end = Math.min(length, Math.round((f + 1) * perFrame));
      for (let at = Math.round(f * perFrame); at < end; at++) {
        if (pos >= v.sample.length) {
          if (v.loopAt === null || v.loopAt >= v.sample.length) return;
          pos = v.loopAt + ((pos - v.loopAt) % (v.sample.length - v.loopAt));
        }
        const k = Math.floor(pos);
        const next = k + 1 < v.sample.length ? v.sample[k + 1] : (v.loopAt !== null ? v.sample[v.loopAt] : 0);
        out[at] += ((v.sample[k] + (next - v.sample[k]) * (pos - k)) / 32768) * gain;
        pos += step;
      }
    });
  }
  return out;
}

/** A line `tools/re/log-dsp.lua` writes for a sounding voice. */
const VOICE = /^f(\d+) v(\d) env=(\d+) pitch=([0-9a-f]+) src=([0-9a-f]+)/;

/** A voice a request started: which, the sample, and each frame's pitch and envelope. */
export interface Heard {
  voice: number;
  src: number;
  frames: VoiceFrame[];
}

/** The effects' samples: the music's sit below `10` (docs/rom.md, The sounds). */
const EFFECT = (src: number) => src >= 0x10;
/** Frames a voice may fall silent between two notes of one sound — Saiyan Meteor's ball re-keys its two voices in turn. */
const GAP = 3;

/**
 * The voices a sound asked for on `frame` keyed on: each that starts a
 * sample — silent the frame before, or on another — within `within` frames,
 * followed while it keeps that sample, `frames` at most. Only the effects'
 * voices, 5–7: the music's 0–4 start notes all the time (every recording so
 * far `?`).
 */
export function voicesFrom(log: string, frame: number, frames: number, within = 8, voices = [5, 6, 7]): Heard[] {
  const at = new Map<number, Map<number, { env: number; pitch: number; src: number }>>();
  for (const line of log.split("\n")) {
    const m = VOICE.exec(line);
    if (!m) continue;
    const f = Number(m[1]);
    if (f < frame || f > frame + within + frames) continue;
    const row = at.get(f) ?? new Map();
    row.set(Number(m[2]), { env: Number(m[3]), pitch: parseInt(m[4], 16), src: parseInt(m[5], 16) });
    at.set(f, row);
  }
  const out: Heard[] = [];
  for (const v of voices) {
    for (let f = frame + 1; f <= frame + within; f++) {
      const now = at.get(f)?.get(v);
      const before = at.get(f - 1)?.get(v);
      if (!now || !EFFECT(now.src) || (before && before.src === now.src)) continue;
      const heard: Heard = { voice: v, src: now.src, frames: [] };
      let silent = 0;
      for (let g = f; g < f + frames; g++) {
        const s = at.get(g)?.get(v);
        if (s && s.src !== now.src) break;
        if (!s) {
          if (++silent > GAP) break;
          heard.frames.push({ pitch: 0x1000, env: 0 });
          continue;
        }
        // back after a silence: a new note, from the sample's top
        heard.frames.push({ pitch: s.pitch, env: s.env, ...((silent > 0 || g === f) && { key: true }) });
        silent = 0;
      }
      // the silence it stopped on is not part of it
      while (heard.frames.length && heard.frames[heard.frames.length - 1].env === 0) heard.frames.pop();
      out.push(heard);
      break;
    }
  }
  return out;
}
