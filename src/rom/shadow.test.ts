import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "./cartridge";
import { fighterNamed } from "./roster";
import { castsShadow, shadowDrawings } from "./shadow";

describe.skipIf(!existsSync(ROM_PATH))("the shadow, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const mrBuu = fighterNamed(rom, "mr_buu").character;
  const goku = fighterNamed(rom, "goku").character;

  it("lists the drawings that have none painted in: Mr. Buu standing, Goku only from his jump on", () => {
    expect(castsShadow(rom, mrBuu, 0x03)).toBe(true);
    expect(castsShadow(rom, mrBuu, 0x0a)).toBe(false);
    expect(castsShadow(rom, goku, 0x00)).toBe(false);
    expect(castsShadow(rom, goku, 0x07)).toBe(true);
  });

  it("reads Mr. Buu's four sizes as a recording's OAM shows the widest", () => {
    const { tiles, sizes } = shadowDrawings(rom, mrBuu);
    expect(sizes.map((pieces) => pieces.length)).toEqual([6, 5, 4, 3]);
    // 80h 84 84 84 84 80, x from +16 to -24, 7 px over the floor (logs: OAM at y 193, floor 200)
    expect(sizes[0].map((p) => [p.dx, p.dy, p.tile, p.hflip])).toEqual([
      [16, -7, 0, true], [8, -7, 4, false], [0, -7, 4, false], [-8, -7, 4, false], [-16, -7, 4, false], [-24, -7, 0, false],
    ]);
    expect(tiles.length).toBeGreaterThan(32 * 5);
  });
});
