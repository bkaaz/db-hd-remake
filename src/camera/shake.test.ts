import { describe, expect, it } from "vitest";
import { Shake } from "./shake";

/** The offsets a shake gives, frame by frame, until it is still. */
function play(shake: Shake): number[] {
  const out: number[] = [];
  for (let i = 0; i < 40; i++) {
    shake.tick();
    out.push(shake.offset);
  }
  while (out.length && out[out.length - 1] === 0) out.pop();
  return out;
}

describe("Shake", () => {
  it("plays the knockdown's 8108 as the original: seven frames", () => {
    const shake = new Shake();
    shake.start({ pattern: 1, frames: 8 });
    expect(play(shake)).toEqual([-4, 2, -2, 3, -3, 2, -2]);
  });

  it("is still before it starts and after it ends", () => {
    const shake = new Shake();
    shake.tick();
    expect(shake.offset).toBe(0);
    shake.start({ pattern: 0, frames: 2 });
    shake.tick();
    expect(shake.offset).toBe(-1);
    shake.tick();
    expect(shake.offset).toBe(0);
  });

  it("goes round the table again past 15 frames", () => {
    const shake = new Shake();
    shake.start({ pattern: 2, frames: 0x20 });
    const offsets = play(shake);
    expect(offsets).toHaveLength(31);
    // 31 left reads entry 15 — the low 4 bits — and counts down from there
    expect(offsets.slice(0, 15)).toEqual([-2, 2, -2, 4, -4, 2, -2, 4, -4, 2, -2, 4, -4, 2, -2]);
    expect(offsets[15]).toBe(0); // 16 left: entry 0
    expect(offsets.slice(0, 15)).toEqual(offsets.slice(16));
  });

  it("is replaced by a new one, not added to", () => {
    const shake = new Shake();
    shake.start({ pattern: 3, frames: 10 });
    shake.tick();
    shake.start({ pattern: 1, frames: 8 });
    expect(play(shake)).toEqual([-4, 2, -2, 3, -3, 2, -2]);
  });
});
