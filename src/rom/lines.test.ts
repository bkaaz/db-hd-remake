import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeWav } from "../audio/wav";
import { ROM_PATH } from "./cartridge";
import { decodeLine, LINE_RATE, lineChunks, spokenLines } from "./lines";
import { fighterNamed } from "./roster";
import { correlation, envelope } from "./envelope.testkit";

const CLIP = "assets/audio/sfx/080.wav";

describe.skipIf(!existsSync(ROM_PATH))("spoken lines from the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("reads a line as its chunks, each a byte count and that many bytes: Goku's Kamehameha", () => {
    expect(lineChunks(rom, 0).map((c) => c.length)).toEqual([2043, 1782]);
  });

  it("decodes every chunk, not only the first, at 8000 a second: 0.85 s", () => {
    expect(decodeLine(rom, 0).length / LINE_RATE).toBeCloseTo(0.85, 3);
  });

  it.skipIf(!existsSync(CLIP))("rises and falls as the capture's clip of it does", () => {
    const clip = decodeWav(readFileSync(CLIP));
    const ours = envelope(decodeLine(rom, 0), LINE_RATE);
    expect(correlation(ours, envelope(clip.samples, clip.sampleRate))).toBeGreaterThan(0.9);
  });

  it("finds the lines a fighter's scripts speak: Vegeta's Final Flash is 0d", () => {
    expect(spokenLines(rom, fighterNamed(rom, "vegeta"))).toContain(0x0d);
  });
});
