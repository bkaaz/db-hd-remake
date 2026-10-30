import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH } from "./cartridge";
import { exportHud } from "./hud";

describe.skipIf(!existsSync(ROM_PATH))("the HUD, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const { image, file } = exportHud(rom, { goku: GOKU.character });
  const pixel = (x: number, y: number) => [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];

  it("takes the bar's tiles by px filled from $00:C6C9, $00:C6CF and $00:C6D8", () => {
    expect(file.bar.first).toEqual([6, 5, 4, 3, 2, 1]);
    expect(file.bar.middle).toEqual([15, 14, 13, 12, 11, 10, 9, 8, 7]);
    expect(file.bar.last).toEqual([21, 20, 19, 18, 17, 16]);
  });

  it("names Goku ゴクウ — three tiles of nine", () => {
    expect(file.names.goku).toEqual([0x52, 0x53, 0x54, 0, 0, 0, 0, 0, 0]);
  });

  it("blacks out the band's first 31 lines and leaves the 32nd to the arena", () => {
    expect(pixel(236, 30)).toEqual([0, 0, 0, 255]);
    expect(pixel(236, 31)[3]).toBe(0);
  });

  it("leaves the cells the fight writes empty", () => {
    const [col, row] = file.number.at[0];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) expect(pixel(8 * col + x, 8 * row + y)[3]).toBe(row * 8 + y < 31 ? 255 : 0);
    expect(pixel(8 * col + 3, 8 * row + 3)).toEqual([0, 0, 0, 255]);
  });
});
