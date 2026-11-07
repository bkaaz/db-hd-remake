import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAND_SCREEN, bandScreen } from "../arena/bands";
import { bandsPicture, windowsOf } from "./bands";
import { ROM_PATH } from "./cartridge";

describe.skipIf(!existsSync(ROM_PATH))("the journey's bands, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const picture = bandsPicture(rom);
  const lit = (screen: number, x: number, y: number) => picture.data[((screen * BAND_SCREEN.height + y) * BAND_SCREEN.width + x) * 4 + 2] > 0;

  it("reads a line's two windows: the first table's top line, 0–32 and 96–160", () => {
    expect(windowsOf(rom, 0x019008, 0)).toEqual([[0, 32], [96, 160]]);
  });

  it("draws the windows lit and the rest black, and the inside-out screen the other way", () => {
    const plain = bandScreen(true, 0, false);
    const out = bandScreen(true, 0, true);
    expect([lit(plain, 10, 0), lit(plain, 60, 0), lit(plain, 120, 0)]).toEqual([true, false, true]);
    expect([lit(out, 10, 0), lit(out, 60, 0), lit(out, 120, 0)]).toEqual([false, true, false]);
  });

  it("lights a line whose window spans it, and leaves one with none black: the lines across the bands", () => {
    const plain = bandScreen(true, 0, false);
    for (const x of [0, 100, 255]) expect(lit(plain, x, 3)).toBe(true);
    for (const x of [0, 100, 255]) expect(lit(plain, x, 31)).toBe(false);
  });

  it("has a screen for every table both ways, plain and inside out", () => {
    expect(picture.height).toBe(BAND_SCREEN.height * 16);
  });
});
