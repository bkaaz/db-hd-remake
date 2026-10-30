/**
 * A fighter, read out of the cartridge into our entity format: one sheet with
 * every drawing and every way a move shows one, its frames, its animations,
 * and the objects it spawns as spawn entities of their own. Pure — the
 * command in scripts/rom.ts only writes what this returns.
 */

import type { Anim, FrameDef } from "../entity/entityFile";
import type { Rgba } from "../sprites/png";
import { animName, jumpCuts, moveAnims, stepStarts } from "./animation";
import { layoutAt, pointer, scriptAt, tileResourceOf, type FighterTables, type SpawnDef } from "./cartridge";
import { readBoxes } from "./collision";
import { decompress } from "./decompress";
import { drawFrame, flipLayout, readLayout, readPalette, type Drawing } from "./frame";
import { PLAIN, parseFrameId, type Look } from "./look";
import { objectFrame } from "./object";
import { objectVram, resourceStream } from "./resource";
import { handlerAt, handlerFacts } from "./handler";
import { readScript, type ScriptOp } from "./script";
import { packSheet, type Placed } from "./sheet";

export interface Exported {
  sheet: Rgba;
  frames: Record<string, FrameDef>;
  animations: Record<string, Anim>;
  /** What was left out, and why — a line each. */
  notes: string[];
  /** The same sheet drawn in another palette, frame for frame (`FighterTables.variants`). */
  variants?: Record<string, Rgba>;
}

/** One drawing as the fighter's sprite shows it, before any offset. */
export function drawDrawing(rom: Uint8Array, t: FighterTables, drawing: number, look: Look = PLAIN, palette = t.palette): Drawing {
  const resource = tileResourceOf(rom, t, drawing);
  if (resource === null) throw new Error(`drawing ${drawing} is unused`);
  const at = resourceStream(rom, resource);
  if (at === null) throw new Error(`drawing ${drawing} wants resource ${resource.toString(16)}, an unused slot`);
  const pieces = flipLayout(readLayout(rom, pointer(rom, layoutAt(t, drawing))), look.h, look.v);
  return drawFrame(decompress(rom, at).data, pieces, readPalette(rom, palette));
}

/** Where the move's handler cuts its script (`jumpCuts`); none when it cannot be read. */
function handlerCuts(rom: Uint8Array, t: FighterTables, move: number, ops: ScriptOp[]): number[] {
  const byHand = HAND_CUTS[move] ?? [];
  try {
    return [...new Set([...jumpCuts(ops, handlerFacts(rom, handlerAt(rom, t.character, move), stepStarts(ops).length)), ...byHand])];
  } catch {
    return byHand;
  }
}

/**
 * Cuts read by hand from handlers `handler.ts` does not follow yet. Charging
 * (`0c`, Goku's `$20:81C2`): entering step 4 while Y and B are held sends
 * the script back to frame 6, step 1 — a loop a state can repeat, cut at
 * both its ends.
 */
const HAND_CUTS: Record<number, number[]> = { 0x0c: [1, 4] };

const BLANK: Drawing = { image: { width: 1, height: 1, data: new Uint8Array(4) }, origin: { x: 0, y: 0 } };

export function exportFighter(rom: Uint8Array, t: FighterTables): Exported {
  const notes: string[] = [];

  // every move id, though many share a script: a state names a move, not a script
  const animations: Record<string, Anim> = {};
  for (let move = 0; move < 0x100; move++) {
    try {
      const ops = readScript(rom, scriptAt(rom, t, move));
      Object.assign(animations, moveAnims(move, ops, (d) => readBoxes(rom, t.boxes, d), handlerCuts(rom, t, move, ops)));
    } catch (e) {
      notes.push(`${animName(move)} left out: ${(e as Error).message}`);
    }
  }

  // every drawing as drawn, plus each way a move shows one (src/rom/look.ts)
  const ids = new Set<string>();
  for (let d = 0; d < t.drawings; d++) if (tileResourceOf(rom, t, d) !== null) ids.add(String(d));
  for (const anim of Object.values(animations)) for (const step of anim.steps) ids.add(step.frame);
  const items: Placed[] = [];
  const variantItems: Record<string, Placed[]> = Object.fromEntries(Object.keys(t.variants ?? {}).map((v) => [v, []]));
  const failed = new Set<string>();
  for (const id of [...ids].sort((a, b) => parseFrameId(a).drawing - parseFrameId(b).drawing || a.localeCompare(b))) {
    try {
      const { drawing, look } = parseFrameId(id);
      // a layout of no pieces is a drawing too: the invisible frame of a vanish
      const empty = readLayout(rom, pointer(rom, layoutAt(t, drawing))).length === 0;
      const { image, origin } = empty ? BLANK : drawDrawing(rom, t, drawing, look);
      // the anchor is the fighter's position: the drawing sits `look`'s offset away from it
      const at = { x: origin.x - look.dx, y: origin.y - look.dy };
      items.push({ id, image, origin: at });
      // same size, same order, so packSheet lays every variant out the same
      for (const [v, palette] of Object.entries(t.variants ?? {})) {
        variantItems[v].push({ id, image: empty ? BLANK.image : drawDrawing(rom, t, drawing, look, palette).image, origin: at });
      }
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
  const variants = Object.fromEntries(Object.entries(variantItems).map(([v, list]) => [v, packSheet(list).sheet]));
  return { ...packSheet(items), animations, notes, variants };
}

/** Each object the fighter's moves spawn that we export, with the tiles and palette its `b0` gives. */
export function exportSpawns(rom: Uint8Array, t: FighterTables): Record<string, Exported> {
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
      if (def && !out[def.name]) out[def.name] = exportSpawn(rom, t, def, op.tiles, op.palette);
    }
  }
  // the rest come from code, not a script: an explosion a projectile turns into
  for (const def of t.objects.spawns) if (!out[def.name]) out[def.name] = exportSpawn(rom, t, def, 0, 2);
  return out;
}

/**
 * One object as a spawn entity: its frames from the tiles the fighter has in
 * VRAM, held as long as the recording says, in a single animation `play`.
 */
export function exportSpawn(rom: Uint8Array, t: FighterTables, def: SpawnDef, tiles: number, palette: number): Exported {
  const vram = objectVram(rom, def.loads ?? t.objects.loads);
  const colours = def.palette ?? t.objects.palettes[palette];
  if (colours === undefined) throw new Error(`${def.name}: no ROM palette known for OAM palette ${palette}`);
  // each animation as the object's frames it shows and how long each is held
  const wanted: Record<string, { frames: number[]; durs: number[]; loop: boolean }> = def.animations
    ? Object.fromEntries(
        Object.entries(def.animations).map(([name, a]) => [name, { frames: a.frames, durs: a.frames.map(() => a.dur), loop: a.loop }]),
      )
    : { play: { frames: def.steps.map((_, step) => def.frames?.[step] ?? step), durs: def.steps, loop: def.loop } };
  const parts = Object.entries(wanted).map(([name, a]) => ({
    name,
    loop: a.loop,
    shows: a.frames.map((frame, i) => ({ frame, dur: a.durs[i] })),
  }));
  const drawn = [...new Set(parts.flatMap((p) => p.shows.map((s) => s.frame)))];
  const items: Placed[] = drawn.map((frame) => {
    const pieces = readLayout(rom, objectFrame(rom, def.type, def.anim, frame)).map((p) => ({ ...p, tile: p.tile + tiles }));
    return { id: String(frame), ...drawFrame(vram, pieces, readPalette(rom, colours)) };
  });
  const { sheet, frames } = packSheet(items);
  const animations: Record<string, Anim> = {};
  for (const part of parts) {
    animations[part.name] = {
      loop: part.loop,
      steps: part.shows.map(({ frame, dur }) => {
        const f = frames[String(frame)];
        // a projectile hits with the whole of its picture: computed, not read
        const box = { type: "hit" as const, x: -f.anchor[0], y: -f.anchor[1], w: f.w, h: f.h };
        return def.hits ? { frame: String(frame), dur, boxes: [box] } : { frame: String(frame), dur };
      }),
    };
  }
  return { sheet, frames, animations, notes: [] };
}
