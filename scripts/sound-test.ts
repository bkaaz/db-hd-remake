/**
 * The original's sound test, recorded by `tools/re/record-sound-test.lua`
 * beside a WAV of Mesen's, cut into one file per entry of its list:
 *
 *   npm run sound-test             into assets/audio/sfx/
 *   npm run sound-test -- --dry-run
 *
 * A file is named by what the game asked for (`catalogue`): `05.wav` is
 * effect 05, `goku_31.wav` Goku's KO, `line_0d.wav` spoken line 0d. Which
 * fighter's voices come where is heard from the cartridge's own samples of
 * them. The level is left as the game played it, so the sounds stay as loud
 * as each other as they were.
 */

import { existsSync, promises as fs } from "node:fs";
import { likeness, resample } from "../src/audio/compare";
import { decodeWav, encodeWav } from "../src/audio/wav";
import { SNES_FPS, catalogue, lag, loud, presses, sounding, span } from "../src/audio/soundTest";
import { ROM_PATH } from "../src/rom/cartridge";
import { ROSTER } from "../src/rom/roster";
import { VOICE_RATE, voiceSamples } from "../src/rom/voice";

const OUT = "assets/audio/sfx";
/**
 * The recordings, in the list's order. The script plays the whole list in one;
 * a second, if there is one, carries on where the first stopped (2026-11-03's
 * was made in two).
 */
const PASSES = [
  { wav: "raw/audio/sound-test-ids.wav", log: "logs/dsp-sound-test.txt" },
  { wav: "raw/audio/sound-test-lines.wav", log: "logs/dsp-sound-test-lines.txt" },
];
/** How far one press's lag may stray from the whole log's, in frames. */
const DRIFT = 20;

interface Cut {
  asked: number | null;
  sampleRate: number;
  /** Null for an entry that played nothing. */
  samples: Float32Array | null;
}

async function cuts(pass: (typeof PASSES)[number]): Promise<Cut[]> {
  const { sampleRate, samples } = decodeWav(await fs.readFile(pass.wav));
  const log = await fs.readFile(pass.log, "utf8");
  const perFrame = sampleRate / SNES_FPS;
  const heard = loud(samples, perFrame);
  const played = sounding(log);
  const by = lag(played, heard, -600, heard.length - played.length + 600);
  console.log(`${pass.wav}: the WAV runs ${(by / SNES_FPS).toFixed(2)} s ahead of the log`);
  return presses(log).map((press) => {
    const at = span(press, lag(played, heard, by - DRIFT, by + DRIFT, press.a - 30, press.quiet + 30), heard);
    // a frame either side: the floor cuts a soft start or end at frame steps
    const from = at && Math.max(0, Math.round((at.from - 1) * perFrame));
    const to = at && Math.min(samples.length, Math.round((at.to + 1) * perFrame));
    return { asked: press.asked, sampleRate, samples: at ? samples.slice(from!, to!) : null };
  });
}

/** The fighter whose own sample `cut` is most like, of the cartridge's blow-taken (or shout) voices. */
function whose(rom: Uint8Array, cut: Cut, voice: "hurt" | "shout"): string {
  const heard = resample(cut.samples ?? new Float32Array(1), cut.sampleRate, VOICE_RATE);
  const scores = ROSTER.map((name, c) => ({ name, score: likeness(heard, voiceSamples(rom, c)[voice]) }));
  return scores.sort((a, b) => b.score - a.score)[0].name;
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry-run");
  const rom = new Uint8Array(await fs.readFile(ROM_PATH));
  const all: Cut[] = [];
  for (const pass of PASSES) if (existsSync(pass.wav)) all.push(...(await cuts(pass)));

  const streamed = all.filter((c) => c.asked === null);
  const fighters = ROSTER.map((_, j) => whose(rom, streamed[3 * j], "hurt"));
  for (const [j, name] of fighters.entries()) {
    const shout = whose(rom, streamed[3 * j + 2], "shout");
    if (shout !== name) console.log(`  ! voices ${j}: the blow taken is ${name}'s, the shout ${shout}'s`);
  }
  console.log(`the fighters' voices, in the list's order: ${fighters.join(", ")}`);

  const names = catalogue(all.map((c) => c.asked), fighters);
  if (!dry) await fs.mkdir(OUT, { recursive: true });
  const silent: string[] = [];
  for (const [i, name] of names.entries()) {
    const { samples, sampleRate } = all[i];
    if (!samples) {
      silent.push(name);
      continue;
    }
    if (!dry) await fs.writeFile(`${OUT}/${name}.wav`, encodeWav({ sampleRate, samples }));
  }
  console.log(`${names.length - silent.length} of ${names.length} entries${dry ? " (dry run)" : ` written to ${OUT}/`}`);
  if (silent.length) console.log(`silent: ${silent.join(", ")}`);
  console.log(names.join(" "));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
