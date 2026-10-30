/**
 * The roster: every fighter's tables read through the cartridge's own
 * per-fighter pointer tables (`rom.md`, Another fighter), so a fighter is a
 * name, not a hand-written list of addresses. What the data does not hold —
 * the objects' pictures and timing — stays per fighter (`GOKU.objects`).
 */

import { pointer, type FighterTables, type Objects } from "./cartridge";
import { paletteRecord } from "./resource";

/**
 * By character (fighter field 0x00), named from their names on the HUD
 * (`$00:C511`, `npm run rom -- hud`): ゴクウ ベジータ ゴハン ゴテンクス
 * ベジット ピッコロ フリーザ セル ミスター・ブウ ブウ. A tenth name, 魔人ブウ,
 * stands in for Mr. Buu's in some modes and has no tables.
 */
export const ROSTER = ["goku", "vegeta", "gohan", "gotenks", "vegetto", "piccolo", "freeza", "cell", "mr_buu", "buu"] as const;
export type FighterName = (typeof ROSTER)[number];

/** 3-byte pointers, one per character: layouts, tile resources, boxes. */
const LAYOUTS = 0x487d2;
const TILE_RESOURCES = 0x487f0;
const BOXES = 0x151aa5;
/** A fighter's palette record by day: `0x40` + 16 × character ($01:82B5). */
const PALETTES = 0x40;

const NO_OBJECTS: Objects = { loads: [], palettes: {}, spawns: [] };

/** A fighter's tables, read from the cartridge; `objects` as given, none by default. */
export function fighterTables(rom: Uint8Array, character: number, objects: Objects = NO_OBJECTS): FighterTables {
  if (character < 0 || character >= ROSTER.length) throw new Error(`no fighter ${character}`);
  const layouts = pointer(rom, LAYOUTS + 3 * character);
  const tileSets = pointer(rom, TILE_RESOURCES + 3 * character);
  return {
    character,
    layouts,
    tileSets,
    // the layout table ends where the tile-resource table begins
    drawings: (tileSets - layouts) / 3,
    palette: paletteRecord(rom, PALETTES + 16 * character).at,
    scripts: character,
    boxes: pointer(rom, BOXES + 3 * character),
    objects,
  };
}

/** A fighter by our name for him, or a loud error naming the roster. */
export function fighterNamed(rom: Uint8Array, name: string, objects?: Objects): FighterTables {
  const character = ROSTER.indexOf(name as FighterName);
  if (character < 0) throw new Error(`no fighter "${name}" — the roster is ${ROSTER.join(", ")}`);
  return fighterTables(rom, character, objects);
}
