import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPLIT,
  DEFAULT_TRIM,
  findClips,
  findLike,
  fingerprint,
  normalise,
  peak,
  similarity,
  trimLeading,
} from "./split";

const RATE = 100; // 100 samples per second keeps the fixtures readable

/** Build a recording from a script of [seconds, amplitude] runs. */
function recording(runs: [number, number][]): Float32Array {
  const total = runs.reduce((n, [s]) => n + Math.round(s * RATE), 0);
  const out = new Float32Array(total);
  let i = 0;
  for (const [seconds, amp] of runs) {
    const n = Math.round(seconds * RATE);
    // Alternate sign so the fixture crosses zero the way real audio does.
    for (let k = 0; k < n; k++, i++) out[i] = k % 2 === 0 ? amp : -amp;
  }
  return out;
}

const opts = { ...DEFAULT_SPLIT, pad: 0 };

describe("findClips", () => {
  it("finds one clip in a recording of one sound", () => {
    const s = recording([
      [0.5, 0],
      [0.4, 0.8],
      [0.5, 0],
    ]);
    const clips = findClips(s, RATE, opts);
    expect(clips).toHaveLength(1);
    expect(clips[0].start).toBe(50);
    expect(clips[0].end).toBe(90);
  });

  it("separates sounds that are far enough apart", () => {
    const s = recording([
      [0.2, 0.8],
      [0.5, 0],
      [0.2, 0.8],
    ]);
    expect(findClips(s, RATE, opts)).toHaveLength(2);
  });

  it("does not cut a sound at its own internal gap", () => {
    // An impact and its tail, with a quiet moment between: one sound, not two.
    const s = recording([
      [0.1, 0.9],
      [0.1, 0],
      [0.2, 0.4],
      [0.5, 0],
    ]);
    expect(findClips(s, RATE, opts)).toHaveLength(1);
  });

  it("ignores hiss below the threshold", () => {
    const s = recording([
      [0.3, 0.005],
      [0.2, 0.8],
      [0.5, 0.005],
    ]);
    const clips = findClips(s, RATE, opts);
    expect(clips).toHaveLength(1);
    expect(clips[0].start).toBe(30);
  });

  it("drops a click too short to be an effect", () => {
    const s = recording([
      [0.5, 0],
      [0.01, 0.9],
      [0.5, 0],
    ]);
    expect(findClips(s, RATE, { ...opts, minLength: 0.05 })).toEqual([]);
  });

  it("closes a clip that runs to the end of the recording", () => {
    const s = recording([
      [0.3, 0],
      [0.4, 0.8],
    ]);
    const clips = findClips(s, RATE, opts);
    expect(clips).toHaveLength(1);
    expect(clips[0].end).toBe(s.length);
  });

  it("finds nothing in silence", () => {
    expect(findClips(recording([[2, 0]]), RATE, opts)).toEqual([]);
  });

  it("pads the edges without running off either end", () => {
    const s = recording([
      [0.05, 0],
      [0.2, 0.8],
      [0.5, 0],
    ]);
    const [clip] = findClips(s, RATE, { ...opts, pad: 0.5 });
    expect(clip.start).toBe(0);
    expect(clip.end).toBeLessThanOrEqual(s.length);
  });
});

describe("peak", () => {
  it("reports the loudest sample in the range", () => {
    const s = recording([
      [0.1, 0.2],
      [0.1, 0.7],
    ]);
    expect(peak(s, { start: 0, end: s.length })).toBeCloseTo(0.7);
    expect(peak(s, { start: 0, end: 10 })).toBeCloseTo(0.2);
  });
});

describe("fingerprint and findLike", () => {
  // A menu blip: a click that decays. An effect: the opposite envelope.
  const blip = (amp: number): [number, number][] => [
    [0.05, amp],
    [0.15, amp / 6],
  ];
  const effect: [number, number][] = [
    [0.15, 0.2],
    [0.15, 0.9],
  ];
  const quiet: [number, number] = [0.4, 0];

  // The blip plays again every time the menu moves, at whatever level the
  // capture happened to be at.
  const s = recording([
    [0.3, 0],
    ...blip(0.9),
    quiet,
    ...effect,
    quiet,
    ...blip(0.45),
    quiet,
    [0.5, 0.6],
    quiet,
  ]);
  const clips = findClips(s, RATE, opts);

  it("finds the four sounds the fixture contains", () => {
    expect(clips).toHaveLength(4);
  });

  it("says a clip is identical to itself", () => {
    const f = fingerprint(s, clips[0]);
    expect(similarity(f, f)).toBeCloseTo(1);
  });

  it("ignores level, so the same sound recorded quieter still matches", () => {
    expect(similarity(fingerprint(s, clips[0]), fingerprint(s, clips[2]))).toBeGreaterThan(0.98);
  });

  it("tells a different envelope apart", () => {
    expect(similarity(fingerprint(s, clips[0]), fingerprint(s, clips[1]))).toBeLessThan(0.9);
  });

  it("finds every copy of the blip and nothing else", () => {
    expect(findLike(s, clips, clips[0])).toEqual([0, 2]);
  });

  it("refuses a sound of a different length even when the shape agrees", () => {
    // Same decaying envelope, three times as long: a different sound.
    const long = recording([
      [0.3, 0],
      [0.15, 0.9],
      [0.45, 0.15],
      quiet,
    ]);
    const [longClip] = findClips(long, RATE, opts);
    expect(findLike(long, [longClip], clips[0])).toEqual([]);
  });
});

describe("trimLeading", () => {
  const blip: [number, number][] = [
    [0.05, 0.9],
    [0.15, 0.15],
  ];

  it("cuts a blip off the front when a gap follows it", () => {
    // Blip, a gap too short for findClips to split on, then the effect.
    const s = recording([
      [0.3, 0],
      ...blip,
      [0.1, 0],
      [0.3, 0.7],
      [0.4, 0],
    ]);
    const [merged] = findClips(s, RATE, opts);
    expect((merged.end - merged.start) / RATE).toBeCloseTo(0.6, 1);

    const reference = { start: 30, end: 50 };
    const out = trimLeading(s, RATE, [merged], reference, {
      ...DEFAULT_TRIM,
      window: 0.02,
    });
    expect(out.trimmed).toEqual([0]);
    expect(out.overlapped).toEqual([]);
    // What is left starts at the effect, not at the blip.
    expect(out.clips[0].start).toBeGreaterThanOrEqual(55);
    expect(out.clips[0].end).toBe(merged.end);
  });

  it("refuses to cut when the two sounds overlap, and says so", () => {
    // No quiet moment at all: the effect starts before the blip has finished.
    const s = recording([
      [0.3, 0],
      ...blip,
      [0.3, 0.7],
      [0.4, 0],
    ]);
    const [merged] = findClips(s, RATE, opts);
    const out = trimLeading(s, RATE, [merged], { start: 30, end: 50 }, DEFAULT_TRIM);
    expect(out.trimmed).toEqual([]);
    expect(out.overlapped).toEqual([0]);
    expect(out.clips[0]).toEqual(merged);
  });

  it("leaves a clip that does not begin with the blip alone", () => {
    // The blip first, so there is a reference; then a sound that rises instead
    // of decaying, which must survive untouched even though it is long enough.
    const s = recording([
      [0.3, 0],
      ...blip,
      [0.4, 0],
      [0.15, 0.2],
      [0.15, 0.9],
      [0.1, 0],
      [0.3, 0.7],
      [0.4, 0],
    ]);
    const [reference, clip] = findClips(s, RATE, opts);
    const out = trimLeading(s, RATE, [clip], reference, DEFAULT_TRIM);
    expect(out).toMatchObject({ trimmed: [], overlapped: [] });
    expect(out.clips[0]).toEqual(clip);
  });

  it("does not trim a clip that is only the blip", () => {
    const s = recording([[0.3, 0], ...blip, [0.4, 0]]);
    const [clip] = findClips(s, RATE, opts);
    const out = trimLeading(s, RATE, [clip], clip, DEFAULT_TRIM);
    expect(out.trimmed).toEqual([]);
    expect(out.clips[0]).toEqual(clip);
  });
});

describe("normalise", () => {
  it("lifts a quiet clip to the target", () => {
    const out = normalise(recording([[0.1, 0.1]]), 0.9);
    expect(Math.max(...[...out].map(Math.abs))).toBeCloseTo(0.9);
  });

  it("pulls a hot clip down to the target", () => {
    const out = normalise(recording([[0.1, 1]]), 0.9);
    expect(Math.max(...[...out].map(Math.abs))).toBeCloseTo(0.9);
  });

  it("leaves silence alone instead of dividing by zero", () => {
    const out = normalise(recording([[0.1, 0]]));
    expect([...out].every((v) => v === 0)).toBe(true);
  });
});
