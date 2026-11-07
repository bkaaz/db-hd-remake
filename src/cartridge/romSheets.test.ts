import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "../rom/cartridge";
import { ROSTER } from "../rom/roster";
import { decodePng } from "../sprites/png";
import { fighterSheet } from "./romSheets";

// The sheet the browser draws is the one the export wrote: frames.json is
// coordinates into it, so one pixel or one row apart breaks every frame.
describe.skipIf(!existsSync(ROM_PATH))("sheets drawn at runtime", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  for (const name of ROSTER.filter((n) => existsSync(`assets/sheets/${n}.png`))) {
    it(`draws ${name}.png as the export wrote it`, () => {
      const drawn = fighterSheet(rom, `${name}.png`)!;
      const exported = decodePng(readFileSync(`assets/sheets/${name}.png`));
      expect([drawn.width, drawn.height]).toEqual([exported.width, exported.height]);
      expect(Buffer.compare(Buffer.from(drawn.data), Buffer.from(exported.data))).toBe(0);
    });
  }

  it("draws nothing for an entity the cartridge does not hold", () => {
    expect(fighterSheet(rom, "goku_old.png")).toBeNull();
  });
});
