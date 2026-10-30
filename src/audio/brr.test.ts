import { describe, expect, it } from "vitest";
import { decodeBrr, playAt, sampleEntry } from "./brr";

/** RAM holding `blocks` from address 0. */
function ram(...blocks: number[][]): Uint8Array {
  const r = new Uint8Array(0x10000);
  r.set(blocks.flat(), 0);
  return r;
}

describe("BRR", () => {
  it("shifts each nibble, halves it, and stops at the end block", () => {
    // shift 12, filter 0, end: nibble 1 → (1 << 12) >> 1 = 2048, kept doubled: 4096
    const out = decodeBrr(ram([0xc1, 0x10, 0, 0, 0, 0, 0, 0, 0xf0]), 0);
    expect(out.length).toBe(16);
    expect(out[0]).toBe(4096);
    expect(out[1]).toBe(0);
    expect(out[14]).toBe(-2048 * 2);
  });

  it("reads past the first block until one marks the end", () => {
    const out = decodeBrr(ram([0xc0, 0, 0, 0, 0, 0, 0, 0, 0], [0xc1, 0, 0, 0, 0, 0, 0, 0, 0]), 0);
    expect(out.length).toBe(32);
  });

  it("runs filter 1 on the sample before: a step decays toward it", () => {
    // first block sets 4096, second block filter 1 with zeros keeps 15/16 of it
    const out = decodeBrr(ram([0xc0, 0x10, 0, 0, 0, 0, 0, 0, 0], [0xc5, 0, 0, 0, 0, 0, 0, 0, 0]), 0);
    expect(out[16]).toBe(0); // filter 0 block's last was 0, so nothing to keep
    const kept = decodeBrr(ram([0xc0, 0, 0, 0, 0, 0, 0, 0, 0x01], [0xc5, 0, 0, 0, 0, 0, 0, 0, 0]), 0);
    expect(kept[15]).toBe(4096);
    // 2048 + (−2048 >> 4) = 1920, kept doubled
    expect(kept[16]).toBe(3840);
  });

  it("finds a sample's start and loop in the directory", () => {
    const r = new Uint8Array(0x10000);
    r.set([0x00, 0x20, 0x09, 0x20], 0x3000 + 4 * 2);
    expect(sampleEntry(r, 0x30, 2)).toEqual({ start: 0x2000, loop: 0x2009 });
  });
});

describe("playAt", () => {
  const ramp = Int16Array.from({ length: 3200 }, (_, i) => i);

  it("plays a sample at its native rate at pitch 0x1000, a frame at a time", () => {
    const out = playAt(ramp, [0x1000, 0x1000], 32000);
    expect(out.length).toBe(Math.ceil(32000 / 60) * 2);
    expect(Math.round(out[100] * 32768)).toBe(100);
  });

  it("goes through it twice as fast at twice the pitch, from the frame it changes", () => {
    const out = playAt(ramp, [0x1000, 0x2000], 32000);
    const frame = Math.ceil(32000 / 60);
    expect(Math.round(out[frame + 10] * 32768) - Math.round(out[frame] * 32768)).toBe(20);
  });
});
