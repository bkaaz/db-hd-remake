import { describe, expect, it } from "vitest";
import {
  rateFor,
  romIds,
  soundIdCollisions,
  soundForLine,
  soundForRom,
  validateSounds,
  type SoundSpec,
  type Sounds,
} from "./sounds";

const ok: SoundSpec = { gain: 0.5, rom: 0x09 };

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
    expect(validateSounds({ hit: ok, block: { gain: 0.4, rom: 0x0a }, voice: { gain: 0.6, line: 0 } })).toEqual([]);
  });

  it("accepts no sounds at all", () => {
    expect(validateSounds(undefined)).toEqual([]);
  });

  it("passes over a note, since JSON has nowhere else to put one", () => {
    const withNote = { _comment: "a note, see src/audio/sounds.ts", hit: ok } as unknown as Sounds;
    expect(validateSounds(withNote)).toEqual([]);
  });

  it("rejects a sound that names no cartridge sound", () => {
    expect(validateSounds({ hit: { gain: 0.5 } })).toEqual([
      'sound "hit": names no cartridge sound — "rom" or "line"',
    ]);
  });

  it("rejects a gain that would clip or be silent", () => {
    expect(validateSounds({ hit: { ...ok, gain: 0 } })).toHaveLength(1);
    expect(validateSounds({ hit: { ...ok, gain: 1.5 } })).toHaveLength(1);
    expect(validateSounds({ hit: { ...ok, gain: 1 } })).toEqual([]);
  });

  it("rejects a variance that could stop or reverse a sample", () => {
    expect(validateSounds({ hit: { ...ok, vary: 1 } })).toHaveLength(1);
    expect(validateSounds({ hit: { ...ok, vary: 0 } })).toEqual([]);
  });
});

describe("rateFor", () => {
  it("is unity with no variance, so a sample plays as recorded", () => {
    expect(rateFor(ok, 0.9)).toBe(1);
  });

  it("spreads either side of unity", () => {
    const spec = { ...ok, vary: 0.1 };
    expect(rateFor(spec, 0)).toBeCloseTo(0.9);
    expect(rateFor(spec, 1)).toBeCloseTo(1.1);
  });

  it("never stops or reverses a sample, however the roll falls", () => {
    const spec = { ...ok, vary: 0.99 };
    for (const roll of [0, 0.25, 0.5, 0.75, 1]) expect(rateFor(spec, roll)).toBeGreaterThan(0);
  });
});

describe("soundForRom", () => {
  const swing = { gain: 0.16 };
  const bank = { _comment: { gain: 1 }, swing_1: { ...swing, rom: 6 }, swing_2: { ...swing, rom: 7 }, hit_1: { ...swing, line: 2 } };

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

describe("romIds", () => {
  it("names the ids a bank answers, the first bank winning", () => {
    const ids = romIds({ land_0c: { gain: 1, rom: 0x0c } }, { voice_shout: { gain: 1, rom: 0x32 }, other: { gain: 1, rom: 0x0c } });
    expect([...ids]).toEqual([[0x0c, "land_0c"], [0x32, "voice_shout"]]);
  });
});
