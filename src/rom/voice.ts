/**
 * A fighter's voice, read out of the cartridge: the two samples the sound
 * chip is given for him as a fight loads ($00:98EC) — the cry of a blow taken
 * (`30`) and an attack's shout (`32`) — and his spoken lines (`lines.ts`), as
 * the entries of his `sounds.json` the export writes. Every fighter's, so
 * nobody has to listen for which clip of the capture is whose.
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

/** The file stems of a fighter's two voice samples: `vegeta_hurt`, `vegeta_shout`. */
export function voiceFiles(fighter: string): { hurt: string; shout: string } {
  return { hurt: `${fighter}_hurt`, shout: `${fighter}_shout` };
}

/**
 * A fighter's sounds with his voice as the export reads it: an entry that
 * names a cartridge id (`rom`) or a spoken line (`line`) is the export's and
 * is written again; anything else is kept as it is.
 */
export function voiceSounds(sounds: Sounds, fighter: string, lines: number[]): Sounds {
  const kept = Object.entries(sounds).filter(([, s]) => s.line === undefined && s.rom === undefined);
  const files = voiceFiles(fighter);
  // the gains and spreads Goku's had when the owner set them from the capture
  const voice: Sounds = {
    voice_hurt: { gain: 0.6, vary: 0.05, file: `${files.hurt}.wav`, rom: 0x30 },
    voice_shout: { gain: 0.55, vary: 0.04, file: `${files.shout}.wav`, rom: 0x32 },
  };
  for (const id of lines) voice[lineName(id)] = { gain: 0.6, vary: 0.03, file: `${lineName(id)}.wav`, line: id };
  return { ...Object.fromEntries(kept), ...voice };
}

function word(rom: Uint8Array, at: number): number {
  return rom[at] | (rom[at + 1] << 8);
}
