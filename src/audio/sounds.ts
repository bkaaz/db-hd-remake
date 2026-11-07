/**
 * Sound definitions: what a noise *is*, without playing it.
 *
 * A sound is the cartridge's: an effect or a voice by its id (`rom`), a
 * spoken line by its id (`line`), played by the cartridge's own driver
 * (ADR 0092). The synth spec (`kind`, `freq`, `decay`) is what a sound with
 * neither can be made of instead, and what plays until the driver's has
 * been rendered.
 *
 * Pure: no Web Audio, no DOM. `src/audio/playback.ts` turns a spec into actual sound.
 */

/** How a placeholder is built. Two shapes cover everything a fighter needs. */
export interface SoundSpec {
  /**
   * `noise` — filtered white noise: impacts, whiffs, anything percussive.
   * `tone` — a falling sine: the thin metallic ring of a blocked blow.
   *
   * Optional when the cartridge plays it (`rom`, `line`): a voice above all
   * has no honest synthesised stand-in, and inventing one is worse than
   * staying silent until it has been rendered.
   */
  kind?: "noise" | "tone";
  /** Centre frequency in Hz. Lower reads as heavier. Synth only. */
  freq?: number;
  /** How long it lasts, in seconds. Impacts are short; 0.05–0.25. Synth only. */
  decay?: number;
  /** Peak volume, 0..1. */
  gain: number;
  /**
   * Random pitch spread, as a fraction of `freq`. A run of identical hits reads
   * as a machine gun; a few percent of wobble is what stops that.
   */
  vary?: number;
  /**
   * What this sounds like, in words — "swing, leg — heavier".
   *
   * Ids in the bank are numbered rather than descriptive, because at three
   * variants a category runs out of adjectives and starts arguing with itself.
   * The label is where the meaning lives instead: for a person reading the
   * file, and for the editor's picker to list. Never used to look anything up.
   */
  label?: string;
  /**
   * The cartridge's id for this sound, the one its scripts play (`a0`, and
   * an animation step's `sfx`). One sound per id, played by the cartridge's
   * driver (`apu/effect.ts`, ADR 0092).
   */
  rom?: number;
  /** Whose voice the driver is given to play `rom` with: a cry, a KO, a shout. */
  fighter?: string;
  /** The spoken line this is, by `a1`'s id ($00:DB98) — a fighter's own voice. */
  line?: number;
}

export type Sounds = Record<string, SoundSpec>;

/** The voice matched to a spoken line's id, or undefined while nobody has matched it. */
export function soundForLine(sounds: Sounds, id: number): string | undefined {
  return Object.keys(sounds).find((name) => !name.startsWith("_") && sounds[name].line === id);
}

/** The cartridge's ids our banks answer (`rom`), to the entry's name — the shared bank and fighters' own. */
export function romIds(...banks: Sounds[]): Map<number, string> {
  const ids = new Map<number, string>();
  for (const bank of banks) for (const [name, spec] of Object.entries(bank)) if (spec.rom !== undefined && !ids.has(spec.rom)) ids.set(spec.rom, name);
  return ids;
}

/** What a sound's sample is kept under: the cartridge's line or id the driver renders, and whose voice. */
export function sampleKey(spec: SoundSpec): string | undefined {
  if (spec.line !== undefined) return `line:${spec.line}`;
  if (spec.rom === undefined) return undefined;
  return spec.fighter ? `rom:${spec.rom}:${spec.fighter}` : `rom:${spec.rom}`;
}

/** The sound matched to a cartridge id, or undefined while nobody has matched it. */
export function soundForRom(sounds: Sounds, id: number): string | undefined {
  return Object.keys(sounds).find((name) => !name.startsWith("_") && sounds[name].rom === id);
}

/**
 * Ids defined in both the game's bank and a fighter's own file.
 *
 * The two files share one id space, so a collision is an error rather than an
 * override. That is the whole reason the split is safe: nobody has to remember
 * which file wins, because winning is not on offer.
 */
export function soundIdCollisions(bank: Sounds, own: Sounds | undefined): string[] {
  return Object.keys(own ?? {})
    .filter((id) => !id.startsWith("_") && id in bank)
    .map((id) => `"${id}" is defined in both the sound bank and the entity; ids must be unique`);
}

/** Problems found in a `sounds.json`, in the same shape the state validator uses. */
export function validateSounds(sounds: Sounds | undefined): string[] {
  const errors: string[] = [];
  const byRom = new Map<number, string>();
  for (const [id, s] of Object.entries(sounds ?? {})) {
    // JSON has no comments, so a key starting with "_" is our note to a reader.
    // It is not a sound and must not be validated as one — reporting four
    // errors about `_comment` on every boot is how a real problem gets ignored.
    if (id.startsWith("_")) continue;
    const where = `sound "${id}"`;
    // A sound is the cartridge's, a synth spec, or both. Only a sound the
    // cartridge does not play has to describe how to make one.
    if ((s.rom === undefined && s.line === undefined) || s.kind !== undefined) {
      if (s.kind !== "noise" && s.kind !== "tone") {
        errors.push(`${where}: "kind" must be "noise" or "tone"`);
      }
      if (!(s.freq !== undefined && s.freq > 0)) {
        errors.push(`${where}: "freq" must be a positive number of Hz`);
      }
      if (!(s.decay !== undefined && s.decay > 0)) {
        errors.push(`${where}: "decay" must be a positive number of seconds`);
      }
    }
    if (!(s.gain > 0) || s.gain > 1) errors.push(`${where}: "gain" must be above 0 and at most 1`);
    if (s.vary !== undefined && (s.vary < 0 || s.vary >= 1)) {
      errors.push(`${where}: "vary" must be at least 0 and below 1`);
    }
    if (s.rom !== undefined) {
      const other = byRom.get(s.rom);
      if (other) errors.push(`${where}: cartridge id ${s.rom} is "${other}" already; one sound per id`);
      byRom.set(s.rom, id);
    }
  }
  return errors;
}

/**
 * The pitch one playback should use, given a spec and a roll of the dice.
 *
 * Split out from playing so the wobble is testable: it is the difference
 * between a series of hits sounding like a fight and like a stuck key.
 */
export function pitchFor(spec: SoundSpec, roll: number): number {
  return (spec.freq ?? 0) * rateFor(spec, roll);
}

/**
 * The same wobble as a ratio, which is what a *sample* needs: a recorded hit is
 * varied by playing it slightly faster or slower, not by retuning a filter.
 * One definition, so the synth and the sample drift together or not at all.
 */
export function rateFor(spec: SoundSpec, roll: number): number {
  const spread = spec.vary ?? 0;
  // roll is 0..1; map it to −spread..+spread around unity.
  return 1 + (roll * 2 - 1) * spread;
}
