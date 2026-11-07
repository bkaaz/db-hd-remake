import { objectBox } from "./collision";
/**
 * A fighter, read out of the cartridge into our entity format: one sheet with
 * every drawing and every way a move shows one, its frames, its animations,
 * and the objects it spawns as spawn entities of their own. Pure — the
 * command in scripts/rom.ts only writes what this returns.
 */

import type { Rgb } from "../entity/palettesFile";
import type { Anim, FrameDef } from "../entity/entityFile";
import type { Rgba } from "../sprites/png";
import { animName } from "./animation";
import { layoutAt, pointer, scriptAt, tileResourceOf, type FighterTables, type SpawnDef } from "./cartridge";
import { decompress } from "./decompress";
import { drawFrame, flipLayout, INDEXED, paint, readLayout, readPalette, type Drawing, type Piece } from "./frame";
import { PLAIN, parseFrameId, type Look } from "./look";
import { shadowFrame } from "../entity/shadow";
import { resourceStream } from "./resource";
import { heldAnims } from "./held";
import { moveParts } from "./parts";
import { readScript } from "./script";
import { castsShadow, shadowDrawings } from "./shadow";
import { packSheet, type Placed } from "./sheet";
import { drawSpawn, lookOf, type SpawnLook } from "./spawnLook";

export interface Exported {
  sheet: Rgba;
  frames: Record<string, FrameDef>;
  animations: Record<string, Anim>;
  /** What was left out, and why — a line each. */
  notes: string[];
  /** The same sheet drawn in another palette, frame for frame (`FighterTables.variants`). */
  variants?: Record<string, Rgba>;
  /** The sheet in colour indices (`INDEXED`), for drawing it in a palette not known here. */
  indexed?: Rgba;
  /** A spawn's pictures, as the browser draws them again (`look.json`). */
  look?: SpawnLook;
}

/** One drawing as the fighter's sprite shows it, before any offset. */
export function drawDrawing(rom: Uint8Array, t: FighterTables, drawing: number, look: Look = PLAIN, palette: number | Rgb[] = t.palette): Drawing {
  const resource = tileResourceOf(rom, t, drawing);
  if (resource === null) throw new Error(`drawing ${drawing} is unused`);
  const at = resourceStream(rom, resource);
  if (at === null) throw new Error(`drawing ${drawing} wants resource ${resource.toString(16)}, an unused slot`);
  const tiles = decompress(rom, at).data;
  // a piece past the set is another resource's, an effect in the drawing: Freeza's ac, tile 135
  const inSet = (p: Piece) => 32 * (p.tile + (p.big ? 0x12 : 1)) <= tiles.length;
  const pieces = flipLayout(readLayout(rom, pointer(rom, layoutAt(t, drawing))).filter(inSet), look.h, look.v);
  return drawFrame(tiles, pieces, typeof palette === "number" ? readPalette(rom, palette) : palette);
}

const BLANK: Drawing = { image: { width: 1, height: 1, data: new Uint8Array(4) }, origin: { x: 0, y: 0 } };

export function exportFighter(rom: Uint8Array, t: FighterTables): Exported {
  const notes: string[] = [];

  // every move id, though many share a script: a state names a move, not a script
  const animations: Record<string, Anim> = {};
  for (let move = 0; move < 0x100; move++) {
    try {
      Object.assign(animations, moveParts(rom, t, move).anims);
    } catch (e) {
      notes.push(`${animName(move)} left out: ${(e as Error).message}`);
    }
  }

  // and every way he can be held, from the throwers' tracks (ADR 0035)
  Object.assign(animations, heldAnims(rom, t.character));

  // every drawing as drawn, plus each way a move shows one (src/rom/look.ts)
  const ids = new Set<string>();
  for (let d = 0; d < t.drawings; d++) if (tileResourceOf(rom, t, d) !== null) ids.add(String(d));
  for (const anim of Object.values(animations)) for (const step of anim.steps) ids.add(step.frame);
  // drawn once in colour indices; every palette is painted over the packed sheet
  const items: Placed[] = [];
  const failed = new Set<string>();
  for (const id of [...ids].sort((a, b) => parseFrameId(a).drawing - parseFrameId(b).drawing || a.localeCompare(b))) {
    try {
      const { drawing, look } = parseFrameId(id);
      // a layout of no pieces is a drawing too: the invisible frame of a vanish
      const empty = readLayout(rom, pointer(rom, layoutAt(t, drawing))).length === 0;
      const { image, origin } = empty ? BLANK : drawDrawing(rom, t, drawing, look, INDEXED);
      // the anchor is the fighter's position: the drawing sits `look`'s offset away from it
      items.push({ id, image, origin: { x: origin.x - look.dx, y: origin.y - look.dy } });
    } catch (e) {
      failed.add(id);
      notes.push(`frame ${id} left out: ${(e as Error).message}`);
    }
  }
  for (const [name, anim] of Object.entries(animations)) {
    const bad = anim.steps.find((s) => failed.has(s.frame));
    if (!bad) continue;
    delete animations[name];
    notes.push(`${name} left out: shows frame ${bad.frame}, which has no picture`);
  }
  // last, so a sheet's other frames stay where they are
  const shadow = shadowDrawings(rom, t.character);
  shadow.sizes.forEach((pieces, size) => {
    const id = shadowFrame(size);
    const { image, origin } = drawFrame(shadow.tiles, pieces, INDEXED);
    items.push({ id, image, origin });
  });
  const packed = packSheet(items);
  const colours = (p: number | Rgb[]) => (typeof p === "number" ? readPalette(rom, p) : p);
  const variants = Object.fromEntries(Object.entries(t.variants ?? {}).map(([v, p]) => [v, paint(packed.sheet, colours(p))]));
  for (const [id, frame] of Object.entries(packed.frames)) {
    if (!id.startsWith("shadow") && castsShadow(rom, t.character, parseFrameId(id).drawing)) frame.shadow = true;
  }
  return { frames: packed.frames, sheet: paint(packed.sheet, readPalette(rom, t.palette)), indexed: packed.sheet, animations, notes, variants };
}

/** Each object the fighter's moves spawn that we export, with the tiles and palette its `b0` gives. */
export function exportSpawns(rom: Uint8Array, t: FighterTables, fighter = "goku"): Record<string, Exported> {
  const out: Record<string, Exported> = {};
  for (let move = 0; move < 0x100; move++) {
    let ops;
    try {
      ops = readScript(rom, scriptAt(rom, t, move));
    } catch {
      continue; // reported by exportFighter
    }
    for (const op of ops) {
      if (op.op !== "spawn") continue;
      const def = t.objects.spawns.find((d) => d.type === op.type && d.anim === op.anim);
      if (def && !out[def.name]) out[def.name] = exportSpawn(rom, t, def, op.tiles, op.palette, fighter);
    }
  }
  // the rest come from code, not a script: an explosion a projectile turns into
  for (const def of t.objects.spawns) if (!out[def.name]) out[def.name] = exportSpawn(rom, t, def, def.tiles ?? 0, 2, fighter);
  return out;
}

/**
 * One object as a spawn entity: its frames from the tiles the fighter has in
 * VRAM, held as long as the recording says, in a single animation `play`.
 */
export function exportSpawn(rom: Uint8Array, t: FighterTables, def: SpawnDef, tiles: number, palette: number, fighter = "goku"): Exported {
  // each animation as the object's frames it shows and how long each is held
  const wanted: Record<string, { frames: number[]; durs: number[]; loop: boolean }> = def.animations
    ? Object.fromEntries(
        Object.entries(def.animations).map(([name, a]) => [name, { frames: a.frames, durs: a.frames.map((_, i) => (typeof a.dur === "number" ? a.dur : a.dur[i])), loop: a.loop }]),
      )
    : { play: { frames: def.steps.map((_, step) => def.frames?.[step] ?? step), durs: def.steps, loop: def.loop } };
  const parts = Object.entries(wanted).map(([name, a]) => ({
    name,
    loop: a.loop,
    shows: a.frames.map((frame, i) => ({ frame, dur: a.durs[i] })),
  }));
  const look = lookOf(t, fighter, def, tiles, palette, [...new Set(parts.flatMap((p) => p.shows.map((s) => s.frame)))]);
  const { sheet, frames, variants } = drawSpawn(rom, t, look);
  const animations: Record<string, Anim> = {};
  for (const part of parts) {
    animations[part.name] = {
      loop: part.loop,
      steps: part.shows.map(({ frame, dur }) => {
        // what it strikes with is its own record, not its picture ($2A:88F6)
        const box = def.hits ? objectBox(rom, def.type, def.anim, frame) : null;
        return box ? { frame: String(frame), dur, boxes: [box] } : { frame: String(frame), dur };
      }),
    };
  }
  return { sheet, frames, animations, notes: [], look, ...(Object.keys(variants).length > 0 && { variants }) };
}
