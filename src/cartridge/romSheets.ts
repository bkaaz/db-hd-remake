/**
 * A fighter's sheets drawn from the cartridge in the browser: his own and
 * every variant, by the export's own code, so `frames.json` points into the
 * same layout the browser draws. The sheet is drawn once in colour indices;
 * a variant is that sheet painted in its palette.
 */

import type { PalettesFile, Rgb } from "../entity/palettesFile";
import { exportFighter } from "../rom/export";
import { paint, readPalette } from "../rom/frame";
import { drawingTables, fighterVariants } from "../rom/fighterVariants";
import type { FrameDef } from "../entity/entityFile";
import type { Rgba } from "../sprites/png";
import { drawSpawn, type SpawnLook } from "../rom/spawnLook";

/** Pictures drawn from the ROM: the sheet and its variants, frame for frame. */
export interface Drawn {
  frames: Record<string, FrameDef>;
  sheet: Rgba;
  /** Each variant's sheet, painted when first asked for. */
  variant(name: string): Rgba;
}

/** A spawn drawn from its `look.json`: its sheet and each variant it names. */
export function drawSpawnLook(rom: Uint8Array, look: SpawnLook): Drawn {
  const t = drawingTables(rom, look.fighter);
  if (!t) throw new Error(`look.json names ${look.fighter}, not a fighter of the cartridge`);
  const { sheet, frames, variants } = drawSpawn(rom, t, look);
  return {
    frames,
    sheet,
    variant(v) {
      if (!variants[v]) throw new Error(`a ${look.type.toString(16)}/${look.anim.toString(16)} object has no palette "${v}"`);
      return variants[v];
    },
  };
}

/** A fighter of the cartridge drawn, or null for a name it does not hold (a spawn). */
export function drawFighter(rom: Uint8Array, name: string, sets?: PalettesFile): Drawn | null {
  const t = drawingTables(rom, name);
  if (!t) return null;
  const drawn = exportFighter(rom, { ...t, variants: {} });
  const palettes = fighterVariants(rom, name, t, sets);
  const indexed = drawn.indexed!;
  return {
    frames: drawn.frames,
    sheet: drawn.sheet,
    variant(v) {
      const p: number | Rgb[] | undefined = palettes[v];
      if (p === undefined) throw new Error(`${name} has no palette "${v}"`);
      return paint(indexed, typeof p === "number" ? readPalette(rom, p) : p);
    },
  };
}
