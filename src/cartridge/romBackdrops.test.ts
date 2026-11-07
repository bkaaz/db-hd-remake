import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "../rom/cartridge";
import { ARENAS, exportArena } from "../rom/arena";
import { exportHud } from "../rom/hud";
import { ROSTER } from "../rom/roster";
import { BAND_SCREEN } from "../arena/bands";
import type { ArenaFile } from "../arena/arenaFile";
import { arenaImages, bandsImage } from "./romBackdrops";

const json = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

/**
 * The browser draws every arena, the bands and the HUD; `arena.json` and
 * `hud.json` are the export's. They must describe the pictures drawn, or a
 * layer scrolls a picture that is not there.
 */
describe.skipIf(!existsSync(ROM_PATH))("backdrops drawn at runtime", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));

  for (const name of Object.keys(ARENAS)) {
    it(`draws every layer ${name}'s arena.json names, in every lighting it names`, () => {
      const file = json<ArenaFile>(`data/arenas/${name}/arena.json`);
      expect(file).toEqual(exportArena(rom, ARENAS[name]).file);
      for (const time of file.times) {
        const drawn = arenaImages(rom, name, time)!;
        const wanted = [
          ...file.layers.flatMap((l) => (l.numbered ? [l.name, `${l.name}-numbers`] : [l.name])),
          ...(file.cycles ?? []).map((_, i) => `cycle${i}`),
        ];
        expect(Object.keys(drawn).sort()).toEqual(wanted.sort());
      }
    });
  }

  it("draws the bands a whole number of screens tall", () => {
    const bands = bandsImage(rom);
    expect([bands.width, bands.height % BAND_SCREEN.height]).toEqual([BAND_SCREEN.width, 0]);
  });

  it("cuts the HUD as hud.json says", () => {
    const roster = Object.fromEntries(ROSTER.map((fighter, character) => [fighter, character]));
    expect(json("data/hud/hud.json")).toEqual(exportHud(rom, roster).file);
  });
});
