/**
 * Cutting one long recording into the clips it contains.
 *
 * A game's sound test plays one effect at a time with silence between, so a
 * single pass through it is a recording of every sound in order. Cutting that
 * by hand is exactly the sort of deterministic, repeatable work this project
 * gives to a script — and unlike hand-cutting, re-running it after a better
 * recording costs nothing.
 *
 * Pure: samples in, ranges out. No file I/O, no Web Audio.
 */

/** A clip found in the recording, as sample offsets. */
export interface Clip {
  start: number;
  end: number;
}

export interface SplitOptions {
  /**
   * Amplitude below which a sample counts as silence, 0..1. Emulator captures
   * are not digitally silent — there is always a little hiss — so this cannot
   * be zero.
   */
  threshold: number;
  /**
   * How much quiet must pass before a clip is considered finished, in seconds.
   * Too short and one effect gets cut into pieces at its own gaps; a hit sound
   * often has a quiet moment between the impact and its tail.
   */
  gap: number;
  /**
   * Clips shorter than this are dropped, in seconds — a click of noise is not
   * a sound effect.
   */
  minLength: number;
  /**
   * Extra samples kept either side of a clip, in seconds, so an attack is not
   * clipped off the front and a tail is not chopped.
   */
  pad: number;
}

export const DEFAULT_SPLIT: SplitOptions = {
  threshold: 0.02,
  gap: 0.25,
  minLength: 0.03,
  pad: 0.01,
};

/**
 * Find the loud stretches of a recording.
 *
 * Works on a running window rather than on single samples: a waveform crosses
 * zero constantly, so testing one sample at a time would chop every clip into
 * hundreds of fragments.
 */
export function findClips(
  samples: Float32Array,
  sampleRate: number,
  opts: SplitOptions = DEFAULT_SPLIT,
): Clip[] {
  const gapSamples = Math.max(1, Math.round(opts.gap * sampleRate));
  const minSamples = Math.max(1, Math.round(opts.minLength * sampleRate));
  const padSamples = Math.max(0, Math.round(opts.pad * sampleRate));

  const clips: Clip[] = [];
  let start = -1;
  let quiet = 0;

  for (let i = 0; i < samples.length; i++) {
    const loud = Math.abs(samples[i]) >= opts.threshold;
    if (loud) {
      if (start < 0) start = i;
      quiet = 0;
    } else if (start >= 0) {
      quiet++;
      if (quiet >= gapSamples) {
        const end = i - quiet + 1;
        if (end - start >= minSamples) clips.push({ start, end });
        start = -1;
        quiet = 0;
      }
    }
  }
  if (start >= 0 && samples.length - start >= minSamples) {
    clips.push({ start, end: samples.length });
  }

  return clips.map((c) => ({
    start: Math.max(0, c.start - padSamples),
    end: Math.min(samples.length, c.end + padSamples),
  }));
}

/**
 * A clip's *shape*, independent of how loud it was and how long it ran: the RMS
 * of a fixed number of equal buckets, scaled to unit length.
 *
 * This exists because a sound test is navigated with a menu, and every press of
 * the cursor plays the menu's own blip alongside the effect being auditioned.
 * The blip is the same recording every time, so it is separable by shape — and
 * by shape only, since deciding it by ear is exactly the kind of judgement this
 * project refuses to spend a human on twice.
 */
export function fingerprint(samples: Float32Array, clip: Clip, buckets = 24): Float32Array {
  const out = new Float32Array(buckets);
  const length = clip.end - clip.start;
  if (length <= 0) return out;

  for (let b = 0; b < buckets; b++) {
    const from = clip.start + Math.floor((b * length) / buckets);
    const to = clip.start + Math.floor(((b + 1) * length) / buckets);
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    out[b] = to > from ? Math.sqrt(sum / (to - from)) : 0;
  }

  let norm = 0;
  for (const v of out) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let b = 0; b < buckets; b++) out[b] /= norm;
  return out;
}

/** How alike two fingerprints are, 0..1 — the cosine of two unit vectors. */
export function similarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export interface LikeOptions {
  /** How alike two shapes must be to count as the same sound, 0..1. */
  minSimilarity: number;
  /**
   * How much the length may differ, as a fraction of the reference. The
   * fingerprint is time-normalised, so without this a long sound with a similar
   * envelope would pass as a short one.
   */
  lengthTolerance: number;
}

export const DEFAULT_LIKE: LikeOptions = { minSimilarity: 0.98, lengthTolerance: 0.15 };

/**
 * Indices of the clips that are the same sound as `reference` — the reference
 * itself included, because dropping a repeat means dropping every copy of it.
 */
export function findLike(
  samples: Float32Array,
  clips: Clip[],
  reference: Clip,
  opts: LikeOptions = DEFAULT_LIKE,
): number[] {
  const ref = fingerprint(samples, reference);
  const refLength = reference.end - reference.start;
  const out: number[] = [];

  for (const [i, clip] of clips.entries()) {
    const length = clip.end - clip.start;
    if (Math.abs(length - refLength) > refLength * opts.lengthTolerance) continue;
    if (similarity(fingerprint(samples, clip), ref) >= opts.minSimilarity) out.push(i);
  }
  return out;
}

export interface TrimOptions {
  /** How alike the head of a clip must be to the blip to count as one. */
  minSimilarity: number;
  /** Amplitude below which the moment between the two sounds counts as a gap. */
  silence: number;
  /** Width of the window the gap is measured over, in seconds. */
  window: number;
}

export const DEFAULT_TRIM: TrimOptions = { minSimilarity: 0.98, silence: 0.02, window: 0.02 };

/**
 * Cut a leading copy of `reference` off the front of every clip that starts
 * with one.
 *
 * When the menu blip and the effect land closer together than `gap`, they
 * arrive as a single clip and no threshold separates them — the pair *is* one
 * loud stretch. But the blip is a known sound of known length, so the join can
 * be found: a clip whose first `reference.length` samples have the blip's shape,
 * followed by a moment of quiet, is two sounds and the quiet is where to cut.
 *
 * A clip with no quiet moment there is genuinely overlapping, and nothing can
 * separate it. Those are reported by index and left alone rather than guessed
 * at — a wrongly trimmed clip loses the attack of the effect, which is the one
 * part of an impact that matters, and the caller needs to know which files came
 * out dirty.
 */
export function trimLeading(
  samples: Float32Array,
  sampleRate: number,
  clips: Clip[],
  reference: Clip,
  opts: TrimOptions = DEFAULT_TRIM,
): { clips: Clip[]; trimmed: number[]; overlapped: number[] } {
  const refLength = reference.end - reference.start;
  const ref = fingerprint(samples, reference);
  const window = Math.max(1, Math.round(opts.window * sampleRate));
  const leadIn = Math.round(0.005 * sampleRate);

  const trimmed: number[] = [];
  const overlapped: number[] = [];

  const out = clips.map((clip, index) => {
    // Too short to be a blip plus anything: it is the blip itself.
    if (clip.end - clip.start < refLength * 1.2) return clip;

    const head = { start: clip.start, end: clip.start + refLength };
    if (similarity(fingerprint(samples, head), ref) < opts.minSimilarity) return clip;

    let quietest = Infinity;
    let at = -1;
    for (let p = Math.round(refLength * 0.7); p + window < refLength * 1.6; p += window) {
      let sum = 0;
      for (let i = clip.start + p; i < clip.start + p + window; i++) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / window);
      if (rms < quietest) {
        quietest = rms;
        at = p;
      }
    }

    if (at < 0 || quietest >= opts.silence) {
      overlapped.push(index);
      return clip;
    }

    // Walk from the gap to where the effect actually starts, keeping a little
    // lead-in so its attack is not shaved off.
    let start = clip.start + at;
    while (start < clip.end && Math.abs(samples[start]) < opts.silence) start++;
    trimmed.push(index);
    return { start: Math.max(clip.start, start - leadIn), end: clip.end };
  });

  return { clips: out, trimmed, overlapped };
}

/** Loudest sample in a range, 0..1 — how close a clip came to clipping. */
export function peak(samples: Float32Array, clip: Clip): number {
  let max = 0;
  for (let i = clip.start; i < clip.end; i++) {
    const v = Math.abs(samples[i]);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Scale a clip so its loudest sample sits at `target`.
 *
 * Sound-test captures come out at wildly different levels — a voice is recorded
 * hotter than a footstep — and levelling them here means `gain` in `sounds.json`
 * stays a creative choice rather than a correction for the recording.
 */
export function normalise(samples: Float32Array, target = 0.9): Float32Array {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  if (max === 0) return samples;
  const scale = target / max;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * scale;
  return out;
}
