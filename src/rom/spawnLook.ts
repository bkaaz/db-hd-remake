/**
 * What an object looks like, apart from how long it shows each frame: the
 * export works it out from the cartridge, its code and a recording, and
 * writes it beside the spawn as `look.json`; the browser draws the pictures
 * again from it and the ROM alone. Timing stays the spawn's `animations.json`.
 */

import type { Rgb } from "../entity/palettesFile";
import type { Rgba } from "../sprites/png";
import { lightingShifts, litPalette } from "./arena";
import type { FighterTables, SpawnDef } from "./cartridge";
import { drawFrame, flipLayout, readLayout, readPalette, type Drawing } from "./frame";
import { withIntroLight } from "./introLight";
import { objectFrame } from "./object";
import { objectVram } from "./resource";
import { packSheet, type Placed } from "./sheet";
import type { FrameDef } from "../entity/entityFile";

export interface SpawnLook {
  /** Whose object it is: his lightings decide the `lit` variants. */
  fighter: string;
  type: number;
  anim: number;
  /** The object's frames drawn, in the order the sheet packs them. */
  frames: number[];
  /** Added to every piece's tile: where its tiles sit in VRAM. */
  tiles: number;
  /** Its own colours: a ROM palette's address, or the colours themselves. */
  palette: number | Rgb[];
  loads: { resource: number; vram: number }[];
  vflip?: true;
  introLight?: true;
  alt?: number;
  shimmer?: number[];
  lit?: SpawnDef["lit"];
}

/** The look of `def` as a `b0` of `tiles` and OAM `palette` puts it out, drawing `frames`. */
export function lookOf(t: FighterTables, fighter: string, def: SpawnDef, tiles: number, palette: number, frames: number[]): SpawnLook {
  const colours = def.palette ?? t.objects.palettes[palette];
  if (colours === undefined) throw new Error(`${def.name}: no ROM palette known for OAM palette ${palette}`);
  return {
    fighter,
    type: def.type,
    anim: def.anim,
    frames,
    tiles,
    palette: colours,
    loads: def.loads ?? t.objects.loads,
    ...(def.vflip && { vflip: def.vflip }),
    ...(def.introLight && { introLight: def.introLight }),
    ...(def.alt !== undefined && { alt: def.alt }),
    ...(def.shimmer && { shimmer: def.shimmer }),
    ...(def.lit && { lit: def.lit }),
  };
}

/** A frame that draws nothing: one transparent pixel, since a frame needs a picture. */
const NOTHING: Drawing = { image: { width: 1, height: 1, data: new Uint8Array(4) }, origin: { x: 0, y: 0 } };

/** Its sheet, its frames' rectangles, and a sheet per variant, frame for frame. */
export function drawSpawn(rom: Uint8Array, t: FighterTables, look: SpawnLook): { sheet: Rgba; frames: Record<string, FrameDef>; variants: Record<string, Rgba> } {
  const vram = objectVram(rom, look.loads);
  const drawIn = (palette: number | Rgb[]): Placed[] =>
    look.frames.map((frame) => {
      const read = readLayout(rom, objectFrame(rom, look.type, look.anim, frame)).map((p) => ({ ...p, tile: p.tile + look.tiles }));
      const pieces = look.vflip ? flipLayout(read, false, true) : read;
      // an empty layout is how an object shows nothing for a while (idle's lightning)
      if (pieces.length === 0) return { id: String(frame), ...NOTHING };
      const drawn = drawFrame(vram, pieces, typeof palette === "number" ? readPalette(rom, palette) : palette);
      return { id: String(frame), ...(look.introLight ? withIntroLight(drawn) : drawn) };
    });
  const { sheet, frames } = packSheet(drawIn(look.palette));
  // the same pictures in each palette of its run pack the same way: frame for frame
  const variants: Record<string, Rgba> = {};
  (look.shimmer ?? []).forEach((palette, i) => (variants[`shimmer${i + 1}`] = packSheet(drawIn(palette)).sheet));
  for (const [name, palette] of Object.entries(litRecords(rom, t, look))) variants[name] = packSheet(drawIn(palette)).sheet;
  if (look.alt !== undefined) variants.alt = packSheet(drawIn(look.alt)).sheet;
  return { sheet, frames, variants };
}

/** An object in its thrower's colours, in every other lighting: each variant's palette (`SpawnDef.lit`). */
function litRecords(rom: Uint8Array, t: FighterTables, look: SpawnLook): Record<string, number | Rgb[]> {
  if (!look.lit) return {};
  const { palette, alt, fades = [] } = look.lit;
  const out: Record<string, number | Rgb[]> = {};
  for (const [time, shift] of Object.entries(lightingShifts(rom, t))) {
    out[time] = litPalette(rom, t, palette, shift);
    if (alt !== undefined) out[`${time}_alt`] = litPalette(rom, t, alt, shift);
    fades.forEach((fade, i) => (out[`${time}_shimmer${i + 1}`] = litPalette(rom, t, fade, shift)));
  }
  return out;
}
