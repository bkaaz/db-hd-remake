/**
 * The cartridge's sound samples against our clips (docs/rom.md, The sounds).
 *
 *   npm run samples                 logs/spc.bin (tools/re/dump-spc.lua) and the
 *                                   pitches in logs/dsp.txt (tools/re/log-dsp.lua)
 *   npm run samples -- --render 38 614 120 meteor_38 [15]
 *                                   the sound asked for on frame 614 of
 *                                   logs/dsp.txt made again from the chip's own
 *                                   sample, its voices' pitch and envelope
 *                                   frame by frame, 120 frames at most, into
 *                                   assets/audio/sfx/meteor_38.wav — for a sound
 *                                   no clip of the capture holds; a last
 *                                   sample number keeps to its voices, when
 *                                   another sound starts beside it
 *   npm run samples -- --sweep 14 5 186
 *                                   sample 14 as voice 5 played it from frame 186
 *                                   of logs/dsp.txt, its pitch frame by frame —
 *                                   for a sound whose pitch slides, which at one
 *                                   pitch matches the wrong clip
 *
 * Every effect sample the recording heard is decoded, written to
 * preview/samples/ at each pitch it was played at most, and compared with
 * every clip in assets/audio/sfx/ — the best three printed. A clip whose
 * likeness stands far above the rest is that sample; one that does not was
 * cut from something else.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeBrr, NATIVE_RATE, playAt, sampleEntry } from "../src/audio/brr.ts";
import { likeness, resample } from "../src/audio/compare.ts";
import { loopIndex, renderVoices, voicesFrom } from "../src/audio/render.ts";
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

/** The three clips most like `sound`, as a line. */
function bestOf(sound: Float32Array): string {
  return clips
    .map((c) => ({ name: c.name, score: likeness(sound, c.samples) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((b) => `${b.name} ${b.score.toFixed(2)}`)
    .join(", ");
}

const render = process.argv.indexOf("--render");
if (render >= 0) {
  const [id, from, frames, name, only] = process.argv.slice(render + 1);
  const heard = voicesFrom(readFileSync(DSP_LOG, "utf8"), Number(from), Number(frames), 10).filter(
    (h) => only === undefined || h.src === parseInt(only, 16),
  );
  if (heard.length === 0) {
    console.error(`no effect voice starts within 10 frames of frame ${from}`);
    process.exit(1);
  }
  const voices = heard.map((h) => {
    const { start, loop } = sampleEntry(ram, dir, h.src);
    const sample = decodeBrr(ram, start);
    return { sample, loopAt: loopIndex(ram, start, loop, sample.length), frames: h.frames };
  });
  const out = `${CLIPS}/${name}.wav`;
  const sound = renderVoices(voices, NATIVE_RATE);
  // the voices' own volumes are not in the log: brought to the capture's 0.9
  // peak, and the bank's gain says how loud
  const peak = sound.reduce((m, s) => Math.max(m, Math.abs(s)), 0) || 1;
  for (let i = 0; i < sound.length; i++) sound[i] *= 0.9 / peak;
  writeFileSync(out, encodeWav({ sampleRate: NATIVE_RATE, samples: sound }));
  const said = heard.map((h) => `v${h.voice} sample ${hex(h.src)} ×${h.frames.length}`).join(", ");
  console.log(`sound ${id} from frame ${from}: ${said} → ${out} (${(sound.length / NATIVE_RATE).toFixed(2)} s)`);
  process.exit(0);
}

const sweep = process.argv.indexOf("--sweep");
if (sweep >= 0) {
  const [src, voice, from] = [parseInt(process.argv[sweep + 1], 16), process.argv[sweep + 2], Number(process.argv[sweep + 3])];
  // the voice's pitch each frame from `from`, while it plays that sample, gaps keeping the last
  const byFrame = new Map<number, number>();
  for (const line of readFileSync(DSP_LOG, "utf8").split("\n")) {
    const m = /^f(\d+) v(\d) env=\d+ pitch=([0-9a-f]+) src=([0-9a-f]+)/.exec(line);
    if (m && m[2] === voice && parseInt(m[4], 16) === src && Number(m[1]) >= from) byFrame.set(Number(m[1]), parseInt(m[3], 16));
  }
  const frames = [...byFrame.keys()].sort((a, b) => a - b);
  if (frames.length === 0) {
    console.error(`voice ${voice} never plays sample ${hex(src)} from frame ${from}`);
    process.exit(1);
  }
  const pitches: number[] = [];
  for (let f = frames[0], last = byFrame.get(frames[0])!; f < frames[0] + 120; f++) pitches.push((last = byFrame.get(f) ?? last));
  const sound = playAt(decodeBrr(ram, sampleEntry(ram, dir, src).start), pitches, RATE);
  writeFileSync(`preview/samples/${hex(src)}_sweep_f${frames[0]}.wav`, encodeWav({ sampleRate: RATE, samples: sound }));
  console.log(`sample ${hex(src)} on voice ${voice} from frame ${frames[0]} (${(sound.length / RATE).toFixed(2)} s): ${bestOf(sound)}`);
  process.exit(0);
}

for (const [src, counts] of [...heard].sort((a, b) => a[0] - b[0])) {
  const { start } = sampleEntry(ram, dir, src);
  const raw = decodeBrr(ram, start);
  const native = Float32Array.from(raw, (v) => v / 32768);
  for (const [pitch] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, PITCHES)) {
    const played = (NATIVE_RATE * pitch) / 0x1000;
    const sound = resample(native, played, RATE);
    writeFileSync(`preview/samples/${hex(src)}_${hex(pitch, 4)}.wav`, encodeWav({ sampleRate: RATE, samples: sound }));
    console.log(`sample ${hex(src)} at ${hex(pitch, 4)} (${(sound.length / RATE).toFixed(2)} s): ${bestOf(sound)}`);
  }
}
