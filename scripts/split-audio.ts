/**
 * Cut one recording of a game's sound test into separate clips.
 *
 *   npm run split-audio -- assets/audio/capture.wav
 *   npm run split-audio -- capture.wav --out assets/audio/sfx --threshold 0.03
 *   npm run split-audio -- capture.wav --dry-run
 *
 * Record one pass through the sound test (see docs/audio-capture.md), then run
 * this. It reports every clip it found with its length and level, so a bad
 * recording is obvious before anything is written — usually as far too many
 * clips, which means the threshold is under the hiss.
 *
 * The clips are game audio: they belong in `assets/audio/`, which is gitignored.
 * This script is ours and is committed; what it produces is not.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DEFAULT_SPLIT,
  findClips,
  findLike,
  normalise,
  peak,
  trimLeading,
  type SplitOptions,
} from "../src/audioSplit";
import { decodeWav, encodeWav } from "./wav";

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const source = argv.find((a) => !a.startsWith("--"));
  if (!source) {
    die(
      "usage: npm run split-audio -- <recording.wav> [--out dir] [--threshold n]\n" +
        "                            [--blip <clip>] [--only 0,3,7] [--dry-run] [--raw]",
    );
  }

  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const num = (name: string, fallback: number): number => {
    const v = flag(name);
    return v === undefined ? fallback : Number(v);
  };

  const opts: SplitOptions = {
    threshold: num("threshold", DEFAULT_SPLIT.threshold),
    gap: num("gap", DEFAULT_SPLIT.gap),
    minLength: num("min", DEFAULT_SPLIT.minLength),
    pad: num("pad", DEFAULT_SPLIT.pad),
  };
  const outDir = flag("out") ?? path.join("assets", "audio", "sfx");
  const dryRun = argv.includes("--dry-run");
  const raw = argv.includes("--raw");

  const { sampleRate, samples } = decodeWav(await fs.readFile(source));
  const seconds = samples.length / sampleRate;
  console.log(
    `${source}: ${seconds.toFixed(1)}s at ${sampleRate} Hz` +
      ` · threshold ${opts.threshold}, gap ${opts.gap}s`,
  );

  let clips = findClips(samples, sampleRate, opts);
  if (clips.length === 0) {
    die("no clips found — the threshold is probably above the recording's level");
  }

  // A sound test is walked with a menu, and the menu answers every press with a
  // blip of its own. Point at one copy of it and every copy goes: cut off the
  // front of the effects it ran into, and dropped where it stands alone. By
  // shape, not by ear — the one judgement a person makes here is which clip it
  // is, and they make it once.
  const overlapping = new Set<number>();
  const blip = flag("blip");
  if (blip !== undefined) {
    const reference = clips[Number(blip)];
    if (!reference) die(`--blip ${blip}: no such clip (0..${clips.length - 1})`);

    const trim = trimLeading(samples, sampleRate, clips, reference);
    const dirty = new Set(trim.overlapped.map((i) => trim.clips[i]));
    clips = trim.clips;
    console.log(
      `  trimmed a leading #${blip} off ${trim.trimmed.length} clip(s)` +
        (dirty.size > 0
          ? `, left ${dirty.size} marked ! where the two sounds overlap and no cut separates them`
          : ""),
    );

    const like = new Set(findLike(samples, clips, reference));
    clips = clips.filter((_, i) => !like.has(i));
    for (const [i, clip] of clips.entries()) if (dirty.has(clip)) overlapping.add(i);
    console.log(`  dropped ${like.size} standalone copy/copies, ${clips.length} clip(s) left`);
    if (clips.length === 0) die("nothing left — was that really the repeated one?");
  }

  const pad = String(clips.length).length;
  // Numbering is of the final list, so writing three now and the rest later
  // gives the same file the same name both times.
  const only = flag("only")
    ?.split(",")
    .map((n) => Number(n.trim()));

  for (const [i, clip] of clips.entries()) {
    if (only && !only.includes(i)) continue;
    const at = (clip.start / sampleRate).toFixed(2).padStart(7);
    const len = ((clip.end - clip.start) / sampleRate).toFixed(3);
    const mark = overlapping.has(i) ? "  ! menu blip still on the front" : "";
    console.log(
      `  ${String(i).padStart(pad, "0")}  at ${at}s  ${len}s  peak ${peak(samples, clip).toFixed(2)}${mark}`,
    );
  }
  console.log(`  ${clips.length} clip(s)` + (raw ? "" : " · levelled to a common peak (--raw to keep)"));
  if (dryRun) {
    console.log("  --dry-run: nothing written");
    return;
  }

  await fs.mkdir(outDir, { recursive: true });
  let written = 0;
  for (const [i, clip] of clips.entries()) {
    if (only && !only.includes(i)) continue;
    const cut = samples.subarray(clip.start, clip.end);
    const file = path.join(outDir, `${String(i).padStart(pad, "0")}.wav`);
    await fs.writeFile(file, encodeWav({ sampleRate, samples: raw ? cut : normalise(cut) }));
    written++;
  }
  console.log(`  wrote ${written} file(s) to ${outDir}/`);
  console.log("  these are game audio: gitignored, and listed in assets.manifest.json if shared");
}

main().catch((err: unknown) => die(err instanceof Error ? err.message : String(err)));
