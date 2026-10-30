import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOKU, ROM_PATH, scriptAt, tileResourceOf } from "./cartridge";
import { fighterNamed, fighterTables, ROSTER } from "./roster";
import { readScript } from "./script";

describe.skipIf(!existsSync(ROM_PATH))("the roster, on the cartridge", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  it("builds Goku's tables equal to the ones found by hand", () => {
    const read = fighterTables(rom, 0);
    for (const key of ["character", "layouts", "tileSets", "drawings", "palette", "scripts", "boxes"] as const) {
      expect(read[key], key).toBe(GOKU[key]);
    }
  });

  it("gives every fighter drawings whose tiles are his own resources", () => {
    ROSTER.forEach((_, c) => {
      const t = fighterTables(rom, c);
      const used = Array.from({ length: t.drawings }, (_, d) => tileResourceOf(rom, t, d)).filter((r) => r !== null);
      expect(used.length, ROSTER[c]).toBeGreaterThan(100);
      // each fighter's resources sit in his own page: Goku 0x1xx, the next 0x2xx …
      expect(new Set(used.map((r) => r! >> 8)).size, ROSTER[c]).toBe(1);
    });
  });

  it("reads nearly all of every fighter's scripts", () => {
    ROSTER.forEach((name, c) => {
      const t = fighterTables(rom, c);
      let read = 0;
      for (let move = 0; move < 0x100; move++) {
        try {
          readScript(rom, scriptAt(rom, t, move));
          read++;
        } catch {
          // a command not read yet (plan.md, reading the cartridge by script)
        }
      }
      expect(read, name).toBeGreaterThan(240);
    });
  });

  it("finds a fighter by name, and says so when there is none", () => {
    expect(fighterNamed(rom, "vegetto").character).toBe(4);
    expect(() => fighterNamed(rom, "trunks")).toThrow(/the roster is goku/);
  });
});
