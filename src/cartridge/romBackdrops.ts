/**
 * What stands behind and over a fight, drawn from the cartridge in the browser
 * (ADR 0090): an arena's pictures in one lighting, the journey's bands, the
 * HUD's tiles. The same code `npm run rom -- export` writes `data/arenas/` and
 * `data/hud/` with, so the shapes those files describe are the ones drawn.
 */

import { ARENAS, arenaPictures } from "../rom/arena";
import { bandsPicture } from "../rom/bands";
import { exportHud } from "../rom/hud";
import { ROSTER } from "../rom/roster";
import type { Rgba } from "../sprites/png";

/** An arena's pictures in `time`, by name (`arenaPictures`), or null for an arena the cartridge does not hold. */
export function arenaImages(rom: Uint8Array, name: string, time: string): Record<string, Rgba> | null {
  const source = ARENAS[name];
  return source ? arenaPictures(rom, source, time) : null;
}

/** Every screen of the journey's bands, one under the next (`arena/bands.ts`). */
export function bandsImage(rom: Uint8Array): Rgba {
  return bandsPicture(rom);
}

/** The HUD's band and its parts' tiles, as `data/hud/hud.json` cuts them. */
export function hudImage(rom: Uint8Array): Rgba {
  return exportHud(rom, Object.fromEntries(ROSTER.map((fighter, character) => [fighter, character]))).image;
}
