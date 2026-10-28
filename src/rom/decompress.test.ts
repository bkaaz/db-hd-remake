import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { decompress } from "./decompress";

/** A stream at offset 0: the u16 size, then the command bytes. */
function stream(size: number, ...commands: number[]): Uint8Array {
  return Uint8Array.from([size & 0xff, size >> 8, ...commands]);
}

describe("decompress", () => {
  it("copies (c + 1) words for 00-3f", () => {
    const { data, end } = decompress(stream(4, 0x01, 1, 2, 3, 4), 0);
    expect([...data]).toEqual([1, 2, 3, 4]);
    expect(end).toBe(7);
  });

  it("repeats one word (c & 3f) + 1 times for 40-7f", () => {
    const { data, end } = decompress(stream(6, 0x42, 7, 8), 0);
    expect([...data]).toEqual([7, 8, 7, 8, 7, 8]);
    expect(end).toBe(5);
  });

  it("copies earlier words for 80-ff, counting the distance in words", () => {
    // two literal words, then 2 words from 2 words back
    const { data } = decompress(stream(8, 0x01, 1, 2, 3, 4, 0x81, 0x01, 0x00), 0);
    expect([...data]).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("lets a back-reference overlap what it writes", () => {
    const { data } = decompress(stream(8, 0x00, 5, 6, 0x80, 0x02, 0x00), 0);
    expect([...data]).toEqual([5, 6, 5, 6, 5, 6, 5, 6]);
  });

  it("refuses a back-reference to before the stream", () => {
    expect(() => decompress(stream(4, 0x00, 1, 2, 0x81, 0x00, 0x00), 0)).toThrow(/before its start/);
  });

  it("drops what the last command writes past the size, and still consumes it", () => {
    const { data, end } = decompress(stream(2, 0x01, 1, 2, 3, 4), 0);
    expect([...data]).toEqual([1, 2]);
    expect(end).toBe(7);
  });
});

// BYOA: the cartridge is the owner's and never in git. The hashes are of what
// the game itself unpacked into BW-RAM, recorded in Mesen on 2026-10-28.
describe.skipIf(!existsSync(ROM_PATH))("decompress, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

  it.each([
    [0x193ae9, 0x19404a, "4cae7af84cac7701a9c79823345b0560cc0ccde9125e76eaee635da03e29f61c"],
    [0x19404d, 0x1945ac, "fbc9e03fb3983c0611d63e840e298d5291af97d0ec82020b14f9539015c957dd"],
  ])("unpacks the stream at %s exactly as the game did", (offset, end, hash) => {
    const out = decompress(rom, offset);
    expect(out.end).toBe(end);
    expect(sha(out.data)).toBe(hash);
  });
});
