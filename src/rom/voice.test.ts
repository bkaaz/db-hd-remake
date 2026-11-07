import { describe, expect, it } from "vitest";
import { voiceSounds } from "./voice";

describe("voiceSounds", () => {
  it("writes the voice and the lines again, and keeps what names neither a cartridge id nor a line", () => {
    const sounds = {
      voice_hurt: { gain: 0.6, rom: 0x30 },
      voice_kame: { gain: 0.6, line: 0 },
      grunt: { gain: 0.5 },
    };
    const out = voiceSounds(sounds, "goku", [0]);
    expect(Object.keys(out).sort()).toEqual(["grunt", "line_00", "voice_hurt", "voice_ko", "voice_shout"]);
    expect(out.voice_hurt).toEqual(expect.objectContaining({ rom: 0x30, fighter: "goku" }));
    expect(out.voice_ko).toEqual(expect.objectContaining({ rom: 0x31, fighter: "goku" }));
    expect(out.line_00).toEqual(expect.objectContaining({ line: 0 }));
  });
});
