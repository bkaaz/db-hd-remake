/**
 * Where a fighter's object takes its tiles from, read from the move that puts
 * it out: what its handler loads, or else its thrower's own sprite. Apart
 * from `ownObjects.ts` because it reads scripts and handlers, which nothing
 * else there does.
 */

import { stepStarts } from "./animation";
import { BURST_LOADS, scriptAt, tileResourceOf, type FighterTables } from "./cartridge";
import { handlerAt, handlerFacts } from "./handler";
import type { Load } from "./resource";
import { readScript, type ScriptOp } from "./script";

/** OBJ VRAM's first word: player one's sprite, unpacked whole from his drawing's tile set. */
const SPRITE = 0x6000;

/** Type `a`, the shared objects: their tiles lie in OBJ VRAM all fight, whatever the move loads (Kakusan's `a/25`, tile base 0). */
const SHARED = 0xa;

/**
 * What the first move whose script spawns `type`/`anim` loads for player one.
 * The handler loads each resource once per player, P1's at the lower address
 * ($6C00, P2's $7C00), and an object's tiles count from P1's. A move that
 * loads none and puts the object at tile base 0 draws it from his sprite:
 * the tile set of the drawing up when it is put out, which holds tiles his
 * drawing never shows (Vegeta's Jumping Bomb and Energy Dash sprays,
 * rom.md). Any other base counts on a load an earlier move made — Galactic
 * Gunfire's shots on `ae`'s — which only its `loads` can say.
 */
export function spawnerLoads(rom: Uint8Array, t: FighterTables, type: number, anim: number): Load[] {
  if (type === SHARED) return BURST_LOADS;
  for (let move = 0; move < 0x100; move++) {
    let ops;
    try {
      ops = readScript(rom, scriptAt(rom, t, move));
    } catch {
      continue;
    }
    if (!ops.some((op) => op.op === "spawn" && op.type === type && op.anim === anim)) continue;
    const facts = handlerFacts(rom, handlerAt(rom, t.character, move), stepStarts(ops).length, t.character);
    const lowest = new Map<number, number>();
    for (const { load } of facts) {
      if (!load || load.vram === null) continue;
      lowest.set(load.resource, Math.min(load.vram, lowest.get(load.resource) ?? Infinity));
    }
    if (lowest.size > 0) return [...lowest].map(([resource, vram]) => ({ resource, vram }));
    const spawn = ops.find((op) => op.op === "spawn" && op.type === type && op.anim === anim);
    if (spawn?.op !== "spawn" || spawn.tiles !== 0) return [];
    const sprite = drawingAtSpawn(ops, type, anim);
    const resource = sprite === null ? null : tileResourceOf(rom, t, sprite);
    return resource === null ? [] : [{ resource, vram: SPRITE }];
  }
  throw new Error(`no move spawns object ${type.toString(16)}/${anim.toString(16)}`);
}

/** The drawing shown from the spawn on: the script puts the object out before its step's drawing. */
export function drawingAtSpawn(ops: ScriptOp[], type: number, anim: number): number | null {
  const at = ops.findIndex((op) => op.op === "spawn" && op.type === type && op.anim === anim);
  for (const op of ops.slice(at)) if (op.op === "show" && op.drawing !== null) return op.drawing;
  return null;
}
