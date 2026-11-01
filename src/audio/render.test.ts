import { describe, expect, it } from "vitest";
import { loopIndex, renderVoices, voicesFrom } from "./render";

// a 32-sample ramp, played at 32000 Hz so pitch 0x1000 is a sample a sample
const RAMP = Int16Array.from({ length: 32 }, (_, i) => i * 1024);
const RATE = 32000;

describe("renderVoices", () => {
  it("plays a voice at its pitch, a frame's worth of samples a frame", () => {
    const out = renderVoices([{ sample: RAMP, loopAt: null, frames: [{ pitch: 0x1000, env: 127 }] }], RATE);
    expect(out.length).toBe(Math.ceil(RATE / 60));
    expect(out[5]).toBeCloseTo((5 * 1024) / 32768);
  });

  it("is silent past the sample's end when it does not loop, and goes round when it does", () => {
    const once = renderVoices([{ sample: RAMP, loopAt: null, frames: [{ pitch: 0x1000, env: 127 }] }], RATE);
    const looped = renderVoices([{ sample: RAMP, loopAt: 16, frames: [{ pitch: 0x1000, env: 127 }] }], RATE);
    expect(once[40]).toBe(0);
    // 40 is 8 past the end: back at 16, and on 8 more
    expect(looped[40]).toBeCloseTo((24 * 1024) / 32768);
  });

  it("scales by the envelope and mixes voices", () => {
    const half = { sample: RAMP, loopAt: null, frames: [{ pitch: 0x1000, env: 63.5 }] };
    const out = renderVoices([half, half], RATE);
    expect(out[4]).toBeCloseTo((4 * 1024) / 32768);
  });

  it("doubles its speed at twice the pitch", () => {
    const out = renderVoices([{ sample: RAMP, loopAt: null, frames: [{ pitch: 0x2000, env: 127 }] }], RATE);
    expect(out[3]).toBeCloseTo((6 * 1024) / 32768);
  });
});

describe("loopIndex", () => {
  it("finds the loop's block from the directory's address, when the end block loops", () => {
    const ram = new Uint8Array(0x10000);
    // two blocks at 0x100; the second ends (bit 0) and loops (bit 1)
    ram[0x109] = 0b11;
    expect(loopIndex(ram, 0x100, 0x109, 32)).toBe(16);
    ram[0x109] = 0b01;
    expect(loopIndex(ram, 0x100, 0x109, 32)).toBeNull();
  });
});

describe("voicesFrom", () => {
  const LOG = [
    "f100 sound 2d",
    "f99 v7 env=127 pitch=0800 src=17",
    "f100 v7 env=127 pitch=0800 src=17",
    // v7 changes sample: started; v6 was silent: started; v2 is music
    "f104 v7 env=127 pitch=049f src=18",
    "f104 v2 env=127 pitch=0400 src=03",
    "f105 v7 env=120 pitch=0406 src=18",
    "f105 v6 env=127 pitch=0264 src=18",
    "f106 v6 env=127 pitch=02c0 src=18",
    "f107 v7 env=127 pitch=0300 src=15",
  ].join("\n");

  it("takes the effects' voices that start a sample after the request, while they keep it", () => {
    const heard = voicesFrom(LOG, 100, 60);
    expect(heard.map((h) => [h.voice, h.src, h.frames.length])).toEqual([
      [6, 0x18, 2],
      [7, 0x18, 2],
    ]);
    expect(heard[1].frames[0]).toEqual({ pitch: 0x49f, env: 127, key: true });
  });

  it("follows a voice through a short silence, the note after it from the sample's top", () => {
    const log = ["f101 v7 env=127 pitch=0400 src=18", "f103 v7 env=127 pitch=0500 src=18", "f110 v7 env=127 pitch=0600 src=18"].join("\n");
    const [heard] = voicesFrom(log, 100, 60);
    // 101, silent 102, 103 keyed again — then silent past the gap, so not 110
    expect(heard.frames).toEqual([
      { pitch: 0x400, env: 127, key: true },
      { pitch: 0x1000, env: 0 },
      { pitch: 0x500, env: 127, key: true },
    ]);
  });

  it("leaves the music's samples, below 10", () => {
    expect(voicesFrom("f101 v5 env=127 pitch=0b1a src=07", 100, 60)).toEqual([]);
  });

  it("leaves a voice that was already playing that sample before the request", () => {
    expect(voicesFrom(LOG, 99, 60, 1).find((h) => h.voice === 7)).toBeUndefined();
  });
});
