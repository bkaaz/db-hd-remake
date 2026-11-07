import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "../rom/cartridge";
import { ROSTER } from "../rom/roster";
import type { PalettesFile } from "../entity/palettesFile";
import type { SpawnLook } from "../rom/spawnLook";
import { drawFighter, drawSpawnLook, type Drawn } from "./romSheets";

const json = <T>(path: string): T | undefined => (existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : undefined);

/**
 * The browser draws every sheet; `frames.json` is the export's. They must
 * agree, or a frame shows the wrong pixels and nothing says so. Compared
 * through JSON, as the export writes them: -0 is 0 there.
 */
function agrees(drawn: Drawn, dir: string): void {
  expect(JSON.parse(JSON.stringify(drawn.frames))).toEqual(json(`${dir}/frames.json`));
  for (const v of json<{ palettes?: string[] }>(`${dir}/attributes.json`)?.palettes ?? []) {
    expect([v, drawn.variant(v).width, drawn.variant(v).height]).toEqual([v, drawn.sheet.width, drawn.sheet.height]);
  }
}

describe.skipIf(!existsSync(ROM_PATH))("sheets drawn at runtime", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  for (const name of ROSTER) {
    it(`draws ${name} where his frames.json says, in every palette he names`, () => {
      const dir = `data/entities/${name}`;
      agrees(drawFighter(rom, name, json<PalettesFile>(`${dir}/palettes.json`))!, dir);
    });
  }

  for (const name of readdirSync("data/spawns")) {
    it(`draws the spawn ${name} where its frames.json says, in every palette it names`, () => {
      const dir = `data/spawns/${name}`;
      const look = json<SpawnLook>(`${dir}/look.json`);
      expect(look, `${name} has no look.json`).toBeDefined();
      agrees(drawSpawnLook(rom, look!), dir);
    });
  }

  it("draws nothing for a name the cartridge does not hold", () => {
    expect(drawFighter(rom, "ki_blast")).toBeNull();
  });
});
