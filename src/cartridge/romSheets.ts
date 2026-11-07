/**
 * POC: a fighter's sheet drawn from the cartridge in the browser, in place of
 * the PNG `npm run rom -- export` wrote — the same code, so the same pixels
 * and the same layout `frames.json` points into. Only the plain sheet: the
 * palette variants still come from assets/.
 */

import { GOKU } from "../rom/cartridge";
import { exportFighter } from "../rom/export";
import { fighterTables, ROSTER } from "../rom/roster";
import type { Rgba } from "../sprites/png";

/** The plain sheet of a fighter of the cartridge, or null for anything else (goku_old, a spawn). */
export function fighterSheet(rom: Uint8Array, sheet: string): Rgba | null {
  const name = sheet.replace(/\.png$/, "");
  const character = ROSTER.indexOf(name as (typeof ROSTER)[number]);
  if (character < 0) return null;
  const tables = name === "goku" ? GOKU : fighterTables(rom, character);
  return exportFighter(rom, { ...tables, variants: {} }).sheet;
}
