/**
 * A fighter's voice: the entries of his `sounds.json` the export writes — the
 * cry of a blow taken (`30`), the KO (`31`), an attack's shout (`32`) and his
 * spoken lines (`lines.ts`) — each played by the cartridge's driver with his
 * samples loaded (`apu/effect.ts`, `apu/line.ts`).
 */

import type { Sounds } from "../audio/sounds";
import { lineName } from "./lines";

/** The bank's one gain (`data/audio/sounds.json`): the driver plays each at the level the game does. */
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
    voice_hurt: { gain: GAIN, vary: 0.05, rom: 0x30, fighter },
    voice_ko: { gain: GAIN, vary: 0, rom: 0x31, fighter },
    voice_shout: { gain: GAIN, vary: 0.04, rom: 0x32, fighter },
  };
  for (const id of lines) voice[lineName(id)] = { gain: GAIN, vary: 0.03, line: id };
  return { ...Object.fromEntries(kept), ...voice };
}
