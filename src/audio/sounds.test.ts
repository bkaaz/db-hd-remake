import { describe, expect, it } from "vitest";
import {
  pitchFor,
  rateFor,
  soundIdCollisions,
  soundForLine,
  soundForRom,
  validateSounds,
  type SoundSpec,
  type Sounds,
} from "./sounds";

const ok: SoundSpec = { kind: "noise", freq: 400, decay: 0.1, gain: 0.5 };

describe("soundIdCollisions", () => {
  it("passes when a fighter only adds ids the bank does not have", () => {
    expect(soundIdCollisions({ hit_1: ok }, { voice_hurt: ok })).toEqual([]);
  });

  it("passes when the fighter has no sounds of their own", () => {
    expect(soundIdCollisions({ hit_1: ok }, undefined)).toEqual([]);
  });

  it("reports an id claimed by both files, so neither silently wins", () => {
    expect(soundIdCollisions({ hit_1: ok, swing_1: ok }, { hit_1: ok })).toEqual([
      '"hit_1" is defined in both the sound bank and the entity; ids must be unique',
    ]);
  });

  it("does not mistake a reader's note for a collision", () => {
    const withNote = { _comment: "voices only", voice_hurt: ok } as unknown as Sounds;
    expect(soundIdCollisions({ _comment: ok, hit_1: ok } as unknown as Sounds, withNote)).toEqual(
      [],
    );
  });
});

describe("validateSounds", () => {
  it("accepts a well-formed set", () => {
    expect(validateSounds({ hit: ok, block: { ...ok, kind: "tone" } })).toEqual([]);
  });

  it("accepts no sounds at all", () => {
    expect(validateSounds(undefined)).toEqual([]);
  });

  it("passes over a note, since JSON has nowhere else to put one", () => {
    const withNote = { _comment: "placeholders, see src/audio/sounds.ts", hit: ok } as unknown as Sounds;
    expect(validateSounds(withNote)).toEqual([]);
  });

  it("rejects an unknown kind", () => {
    const bad = { hit: { ...ok, kind: "beep" } } as unknown as Sounds;
    expect(validateSounds(bad)).toContain('sound "hit": "kind" must be "noise" or "tone"');
  });

  it("rejects nonsense numbers", () => {
    expect(validateSounds({ hit: { ...ok, freq: 0 } })).toContain(
      'sound "hit": "freq" must be a positive number of Hz',
    );
    expect(validateSounds({ hit: { ...ok, decay: -1 } })).toContain(
      'sound "hit": "decay" must be a positive number of seconds',
    );
  });

  it("rejects a gain that would clip or be silent", () => {
    expect(validateSounds({ hit: { ...ok, gain: 0 } })).toHaveLength(1);
    expect(validateSounds({ hit: { ...ok, gain: 1.5 } })).toHaveLength(1);
    expect(validateSounds({ hit: { ...ok, gain: 1 } })).toEqual([]);
  });

  it("rejects a variance that could invert the pitch", () => {
    expect(validateSounds({ hit: { ...ok, vary: 1 } })).toHaveLength(1);
    expect(validateSounds({ hit: { ...ok, vary: 0 } })).toEqual([]);
  });
});

describe("a sound backed by a sample", () => {
  it("accepts a file alongside the spec that stands in for it", () => {
    expect(validateSounds({ hit: { ...ok, file: "007.wav" } })).toEqual([]);
  });

  it("accepts a sample with no synth spec at all — a voice has no stand-in", () => {
    expect(validateSounds({ voice_hurt: { gain: 0.6, file: "042.wav" } })).toEqual([]);
  });

  it("still demands a spec from a sound with no sample to fall back on", () => {
    expect(validateSounds({ hit: { gain: 0.5 } })).toHaveLength(3);
  });

  it("rejects something that is not a wav", () => {
    expect(validateSounds({ hit: { ...ok, file: "007" } })).toContain(
      'sound "hit": "file" must be the name of a .wav in assets/audio/sfx',
    );
  });
});

describe("rateFor", () => {
  it("is unity with no variance, so a sample plays as recorded", () => {
    expect(rateFor(ok, 0.9)).toBe(1);
  });

  it("spreads either side of unity, the same wobble the pitch uses", () => {
    const spec = { ...ok, vary: 0.1, freq: 400 };
    expect(rateFor(spec, 0)).toBeCloseTo(0.9);
    expect(rateFor(spec, 1)).toBeCloseTo(1.1);
    // One definition: the synth's pitch is the centre frequency times the rate.
    expect(pitchFor(spec, 0.25)).toBeCloseTo(400 * rateFor(spec, 0.25));
  });

  it("never stops or reverses a sample, however the roll falls", () => {
    const spec = { ...ok, vary: 0.99 };
    for (const roll of [0, 0.25, 0.5, 0.75, 1]) expect(rateFor(spec, roll)).toBeGreaterThan(0);
  });
});

describe("pitchFor", () => {
  it("is the centre frequency with no variance", () => {
    expect(pitchFor(ok, 0.9)).toBe(400);
  });

  it("spreads either side of the centre", () => {
    const spec = { ...ok, vary: 0.1 };
    expect(pitchFor(spec, 0)).toBeCloseTo(360);
    expect(pitchFor(spec, 0.5)).toBeCloseTo(400);
    expect(pitchFor(spec, 1)).toBeCloseTo(440);
  });

  it("never inverts, however the roll falls", () => {
    const spec = { ...ok, vary: 0.99 };
    for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
      expect(pitchFor(spec, roll)).toBeGreaterThan(0);
    }
  });
});

describe("soundForRom", () => {
  const swing = { kind: "noise" as const, freq: 1600, decay: 0.07, gain: 0.16 };
  const bank = { _comment: { gain: 1 }, swing_1: { ...swing, rom: 6 }, swing_2: { ...swing, rom: 7 }, hit_1: swing };

  it("finds the sound matched to a cartridge id", () => {
    expect(soundForRom(bank, 7)).toBe("swing_2");
  });

  it("is undefined for an id nobody has matched", () => {
    expect(soundForRom(bank, 9)).toBeUndefined();
  });

  it("is refused twice: one sound per cartridge id", () => {
    const twice = { swing_1: { ...swing, rom: 6 }, swing_3: { ...swing, rom: 6 } };
    expect(validateSounds(twice).some((e) => e.includes("cartridge id 6"))).toBe(true);
  });

describe("soundForLine", () => {
  it("finds the voice matched to a spoken line, apart from the sound ids", () => {
    const voices = { voice_kame: { gain: 0.6, file: "080.wav", line: 0 }, voice_hurt: { gain: 0.6, file: "042.wav", rom: 0x30 } };
    expect(soundForLine(voices, 0)).toBe("voice_kame");
    expect(soundForLine(voices, 0x30)).toBeUndefined();
  });
});
});
