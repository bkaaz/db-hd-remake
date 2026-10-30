import { describe, expect, it } from "vitest";
import { lzss } from "./lzss";

/** A stream at offset 0: the u16 size, then flags and items. */
function stream(size: number, ...bytes: number[]): Uint8Array {
  return Uint8Array.from([size & 0xff, size >> 8, ...bytes]);
}

describe("lzss", () => {
  it("copies a byte for each set flag bit, read from bit 0", () => {
    expect([...lzss(stream(3, 0b111, 7, 8, 9), 0)]).toEqual([7, 8, 9]);
  });

  it("copies (lo & 0f) + 3 bytes from a 12-bit distance back", () => {
    // two literals, then 3 bytes from 2 back
    expect([...lzss(stream(5, 0b011, 1, 2, 0x20, 0x00), 0)]).toEqual([1, 2, 1, 2, 1]);
  });

  it("takes the distance's upper bits from the second byte", () => {
    const literals = Array.from({ length: 16 }, (_, i) => i);
    const data = lzss(stream(19, 0xff, ...literals.slice(0, 8), 0xff, ...literals.slice(8), 0x00, 0x00, 0x01), 0);
    expect([...data.slice(16)]).toEqual([0, 1, 2]);
  });

  it("reads what lies before the output's start as zero", () => {
    expect([...lzss(stream(4, 0b01, 5, 0x21, 0x00), 0)]).toEqual([5, 0, 5, 0]);
  });

  it("stops at the size even mid-copy", () => {
    expect([...lzss(stream(4, 0b01, 5, 0x1f, 0x00), 0)]).toEqual([5, 5, 5, 5]);
  });
});
