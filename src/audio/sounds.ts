/**
 * Sound definitions: what a noise *is*, without playing it.
 *
 * No usable rip of this game's effects was found — the one archive that has it
 * refuses automated reads, and what is downloadable elsewhere is the music, not
 * the hits. Rather than block the whole feature on an asset hunt, a sound is
 * **described by parameters and synthesised at runtime**, the same answer we
 * reached for the hit spark. A blow already decides how it is taken, how long
 * the game stops, what it looks like and what it costs; now also how it sounds.
 *
 * These are placeholders in the honest sense: they make the game audible today
 * and they are meant to be replaced. `file` is reserved for that — when real
 * samples exist, a sound gains a path and the synth spec stops being used,
 * without a single state changing.
 *
 * Pure: no Web Audio, no DOM. `src/audio/playback.ts` turns a spec into actual sound.
 */

/** How a placeholder is built. Two shapes cover everything a fighter needs. */
export interface SoundSpec {
  /**
   * `noise` — filtered white noise: impacts, whiffs, anything percussive.
   * `tone` — a falling sine: the thin metallic ring of a blocked blow.
   *
   * Optional only when there is a `file`: some sounds — a voice above all —
   * have no honest synthesised stand-in, and inventing one is worse than
   * staying silent until the sample arrives.
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
   * A real sample, once one exists: the name of a `.wav` in `assets/audio/sfx`,
   * cut from the sound-test capture (`data/audio/sound-test.json` says which
   * clip is what). Takes precedence over the synth spec once it has loaded —
   * the spec stays as the fallback, so the game is audible from the first frame
   * and stays audible if a file is missing.
   */
  file?: string;
  /**
   * What this sounds like, in words — "swing, leg — heavier".
   *
   * Ids in the bank are numbered rather than descriptive, because at three
   * variants a category runs out of adjectives and starts arguing with itself.
   * The label is where the meaning lives instead: for a person reading the
   * file, and for the editor's picker to list. Never used to look anything up.
   */
  label?: string;
}

export type Sounds = Record<string, SoundSpec>;

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
  for (const [id, s] of Object.entries(sounds ?? {})) {
    // JSON has no comments, so a key starting with "_" is our note to a reader.
    // It is not a sound and must not be validated as one — reporting four
    // errors about `_comment` on every boot is how a real problem gets ignored.
    if (id.startsWith("_")) continue;
    const where = `sound "${id}"`;
    // A sound is a synth spec, a sample, or both. Only a sound with nothing to
    // play back has to describe how to make one.
    if (s.file === undefined || s.kind !== undefined) {
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
    // The synth spec stays valid even with a sample attached: it is what plays
    // until the file has loaded, and if the file is missing it is all there is.
    if (s.file !== undefined && (typeof s.file !== "string" || !s.file.endsWith(".wav"))) {
      errors.push(`${where}: "file" must be the name of a .wav in assets/audio/sfx`);
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
