import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeWav } from "../audio/wav";
import { ROM_PATH } from "./cartridge";
import { correlation, envelope } from "./envelope.testkit";
import { VOICE_RATE, voiceSamples, voiceSounds } from "./voice";

const clip = (n: string) => `assets/audio/sfx/${n}.wav`;

describe.skipIf(!existsSync(ROM_PATH))("a fighter's voice from the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const goku = voiceSamples(rom, 0);

  it.skipIf(!existsSync(clip("045")) || !existsSync(clip("042")))("rises and falls as the clips the owner chose for Goku's do", () => {
    for (const [ours, name] of [[goku.shout, "045"], [goku.hurt, "042"]] as const) {
      const theirs = decodeWav(readFileSync(clip(name)));
      expect(correlation(envelope(ours, VOICE_RATE), envelope(theirs.samples, theirs.sampleRate))).toBeGreaterThan(0.85);
    }
  });

  it("reads each fighter's own samples by his character: Vegeta's are not Goku's", () => {
    const vegeta = voiceSamples(rom, 1);
    expect(vegeta.shout.length).toBeGreaterThan(0);
    expect(vegeta.shout.length).not.toBe(goku.shout.length);
  });
});

describe("voiceSounds", () => {
  it("writes the voice and the lines again, and keeps what names neither a cartridge id nor a line", () => {
    const sounds = {
      voice_hurt: { gain: 0.6, file: "042.wav", rom: 0x30 },
      voice_kame: { gain: 0.6, file: "080.wav", line: 0 },
      grunt: { gain: 0.5, file: "099.wav" },
    };
    const out = voiceSounds(sounds, "goku", [0]);
    expect(Object.keys(out).sort()).toEqual(["grunt", "line_00", "voice_hurt", "voice_shout"]);
    expect(out.voice_hurt).toMatchObject({ file: "goku_hurt.wav", rom: 0x30 });
    expect(out.line_00).toMatchObject({ file: "line_00.wav", line: 0 });
  });
});
