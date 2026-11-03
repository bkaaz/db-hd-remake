/**
 * A fighter's voice: the entries of his `sounds.json` the export writes — the
 * cry of a blow taken (`30`), the KO (`31`), an attack's shout (`32`) and his
 * spoken lines (`lines.ts`) — each on its file of the sound test's recording
 * (`npm run sound-test`). And the two samples the sound chip is given for him
 * as a fight loads ($00:98EC), read out of the cartridge, by which that
 * recording tells whose voices are whose.
 */

import type { Sounds } from "../audio/sounds";
import { decodeBrr } from "../audio/brr";
import { pointer, toFile } from "./cartridge";
import { lineName } from "./lines";

/**
 * By character, three pointers ($00:98EF, `× 9`): player one's sample
 * directory, player two's, and the samples — each a byte count and the
 * address in the chip's RAM it goes to, then the bytes.
 */
const VOICES = toFile(0x00dd48)!;
/** The pitch both voices play at (`32` and `33` recorded at `03F6`, `rom.md`, The sounds), as a sample rate. */
export const VOICE_RATE = (32000 * 0x3f6) / 0x1000;

/** Character `character`'s two voice samples, −1..1 at `VOICE_RATE`. */
export function voiceSamples(rom: Uint8Array, character: number): { hurt: Float32Array; shout: Float32Array } {
  const dir = pointer(rom, VOICES + 9 * character);
  const data = pointer(rom, VOICES + 9 * character + 6);
  // the chip's RAM as the load leaves it: the samples where they go
  const ram = new Uint8Array(0x10000);
  ram.set(rom.subarray(data + 4, data + 4 + word(rom, data)), word(rom, data + 2));
  // the directory's entries: start, loop — one per sample, after its count and address
  const sample = (n: number) => Float32Array.from(decodeBrr(ram, word(rom, dir + 4 + 4 * n)), (s) => s / 32768);
  return { hurt: sample(0), shout: sample(1) };
}

/** The bank's one gain (`data/audio/sounds.json`): the files keep the levels the game plays them at. */
const GAIN = 0.85;

/**
 * A fighter's sounds with his voice as the export reads it: an entry that
 * names a cartridge id (`rom`) or a spoken line (`line`) is the export's and
 * is written again; anything else is kept as it is.
 */
export function voiceSounds(sounds: Sounds, fighter: string, lines: number[]): Sounds {
  const kept = Object.entries(sounds).filter(([, s]) => s.line === undefined && s.rom === undefined);
  // the spreads Goku's had when the owner set them
  const voice: Sounds = {
    voice_hurt: { gain: GAIN, vary: 0.05, file: `${fighter}_30.wav`, rom: 0x30 },
    voice_ko: { gain: GAIN, vary: 0, file: `${fighter}_31.wav`, rom: 0x31 },
    voice_shout: { gain: GAIN, vary: 0.04, file: `${fighter}_32.wav`, rom: 0x32 },
  };
  for (const id of lines) voice[lineName(id)] = { gain: GAIN, vary: 0.03, file: `${lineName(id)}.wav`, line: id };
  return { ...Object.fromEntries(kept), ...voice };
}

function word(rom: Uint8Array, at: number): number {
  return rom[at] | (rom[at + 1] << 8);
}
