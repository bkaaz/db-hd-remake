/**
 * Every palette a fighter's sheet is drawn in besides his own, by the name
 * the game asks for it (`Attributes.palettes`): the arena's lightings, his
 * glow, player two's colours, the fire a beam leaves, Shocking Stunner's
 * flash, and our colour sets over all of them. One list for the export and
 * the browser, so both draw the same sheets.
 */

import type { PalettesFile, Rgb } from "../entity/palettesFile";
import { altPalettes, flashPalettes, glowPalettes, introPalettes, lightingPalettes, runPalettes, winPalettes } from "./arena";
import { CANDY, FIRE, GOKU, SHOCK, type FighterTables } from "./cartridge";
import { setsOver } from "./recolour";
import { paletteRecord } from "./resource";
import { fighterTables, ROSTER, type FighterName } from "./roster";

/** A fighter of the cartridge's tables for drawing him, or null for a name it does not hold. */
export function drawingTables(rom: Uint8Array, name: string): FighterTables | null {
  const character = ROSTER.indexOf(name as FighterName);
  if (character < 0) return null;
  // Goku's palettes and tile tables are the hand-checked ones; the drawings are the same
  return name === "goku" ? GOKU : fighterTables(rom, character);
}

/**
 * His variants: a ROM palette's address, or the colours of one of our sets.
 * Goku's take no winning, intro or flash palettes: his 3e loads none ($20:80D6).
 */
export function fighterVariants(rom: Uint8Array, name: string, t: FighterTables, sets?: PalettesFile): Record<string, number | Rgb[]> {
  const shock = Object.fromEntries(Object.entries({ ...SHOCK, ...CANDY }).map(([n, record]) => [n, paletteRecord(rom, record).at]));
  const lit: Record<string, number> =
    name === "goku"
      ? { ...lightingPalettes(rom, t), ...glowPalettes(rom, t), ...altPalettes(rom, t) }
      : { ...lightingPalettes(rom, t), ...glowPalettes(rom, t), ...flashPalettes(rom, t), ...altPalettes(rom, t), ...winPalettes(rom, t), ...runPalettes(rom, t) };
  const intro = name === "goku" ? {} : introPalettes(rom, t);
  const own = sets ? setsOver(rom, t.palette, lit, sets) : {};
  return { ...FIRE, ...shock, ...lit, ...intro, ...own };
}
