/**
 * The cartridge's sound samples against our clips (docs/rom.md, The sounds).
 *
 *   npm run samples                 logs/spc.bin (tools/re/dump-spc.lua) and the
 *                                   pitches in logs/dsp.txt (tools/re/log-dsp.lua)
 *
 * Every effect sample the recording heard is decoded, written to
 * preview/samples/ at each pitch it was played at most, and compared with
 * every clip in assets/audio/sfx/ — the best three printed. A clip whose
 * likeness stands far above the rest is that sample; one that does not was
 * cut from something else.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeBrr, NATIVE_RATE, sampleEntry } from "../src/audio/brr.ts";
import { likeness, resample } from "../src/audio/compare.ts";
import { decodeWav, encodeWav } from "../src/audio/wav.ts";

const SPC = "logs/spc.bin";
const DSP_LOG = "logs/dsp.txt";
const CLIPS = "assets/audio/sfx";
/** What both are brought to before they are compared: enough for a hit or a swing. */
const RATE = 16000;
/** Pitches tried per sample, the most played first. */
const PITCHES = 2;

for (const file of [SPC, DSP_LOG]) {
  if (!existsSync(file)) {
    console.error(`no ${file} — record it with tools/re/`);
    process.exit(1);
  }
}
const dump = new Uint8Array(readFileSync(SPC));
const ram = dump.subarray(0, 0x10000);
const dir = dump[0x10000 + 0x5d];

// which samples the recording heard, and at which pitches, most played first
const heard = new Map<number, Map<number, number>>();
for (const line of readFileSync(DSP_LOG, "utf8").split("\n")) {
  const m = /v\d env=\d+ pitch=([0-9a-f]+) src=([0-9a-f]+)/.exec(line);
  if (!m) continue;
  const [pitch, src] = [parseInt(m[1], 16), parseInt(m[2], 16)];
  const counts = heard.get(src) ?? new Map<number, number>();
  counts.set(pitch, (counts.get(pitch) ?? 0) + 1);
  heard.set(src, counts);
}

const clips = readdirSync(CLIPS)
  .filter((f) => f.endsWith(".wav"))
  .map((f) => {
    const w = decodeWav(readFileSync(`${CLIPS}/${f}`));
    return { name: f, samples: resample(w.samples, w.sampleRate, RATE) };
  });

mkdirSync("preview/samples", { recursive: true });
const hex = (n: number, w = 2) => n.toString(16).padStart(w, "0");
for (const [src, counts] of [...heard].sort((a, b) => a[0] - b[0])) {
  const { start } = sampleEntry(ram, dir, src);
  const raw = decodeBrr(ram, start);
  const native = Float32Array.from(raw, (v) => v / 32768);
  for (const [pitch] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, PITCHES)) {
    const played = (NATIVE_RATE * pitch) / 0x1000;
    const sound = resample(native, played, RATE);
    writeFileSync(`preview/samples/${hex(src)}_${hex(pitch, 4)}.wav`, encodeWav({ sampleRate: RATE, samples: sound }));
    const best = clips
      .map((c) => ({ name: c.name, score: likeness(sound, c.samples) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    console.log(`sample ${hex(src)} at ${hex(pitch, 4)} (${(sound.length / RATE).toFixed(2)} s): ${best.map((b) => `${b.name} ${b.score.toFixed(2)}`).join(", ")}`);
  }
}
