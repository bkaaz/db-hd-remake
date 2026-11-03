import type { ColourSet, PalettesFile, Rgb } from "../entity/palettesFile";
import { readPalette } from "./frame";

/**
 * A palette with one of our colour sets applied (`palettes.json`): read off
 * the palette itself, so a set made by day is right by night and in the glow
 * too. `own` is the fighter's own palette, which a set's literal colours
 * were picked against.
 */
export function recolour(set: ColourSet, palette: readonly Rgb[], own: readonly Rgb[]): Rgb[] {
  const out = palette.map((c) => [...c] as Rgb);
  for (const [at, rule] of Object.entries(set)) {
    const i = Number(at);
    if (typeof rule === "number") out[i] = [...palette[rule]] as Rgb;
    else out[i] = palette[rule.from].map((c, ch) => snap((c * rule.own[ch]) / Math.max(own[rule.from][ch], 1))) as Rgb;
  }
  return out;
}

/** To the SNES's 5 bits a channel, as every colour the export draws. */
function snap(v: number): number {
  return Math.max(0, Math.min(248, Math.round(v / 8) * 8));
}

/**
 * Every variant he is drawn in, again in each set: `gold` beside his own
 * colours, `night_glow_gold` beside `night_glow`. `palettes` are the
 * variants' colours by name, `""` his own.
 */
export function setVariants(file: PalettesFile, palettes: Record<string, readonly Rgb[]>): Record<string, Rgb[]> {
  const own = palettes[""];
  const out: Record<string, Rgb[]> = {};
  for (const [set, rule] of Object.entries(file.sets)) {
    for (const [name, palette] of Object.entries(palettes)) out[name ? `${name}_${set}` : set] = recolour(rule, palette, own);
  }
  return out;
}

/** `setVariants` over palettes in the ROM: his own at `own`, the rest by name. */
export function setsOver(rom: Uint8Array, own: number, variants: Record<string, number>, file: PalettesFile): Record<string, Rgb[]> {
  const palettes = Object.fromEntries([["", own], ...Object.entries(variants)].map(([name, at]) => [name, readPalette(rom, at as number)]));
  return setVariants(file, palettes);
}
