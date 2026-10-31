/**
 * A fighter's own objects — a special's shot, its flash — as spawn defs,
 * with nothing about them written by hand but their names: the tiles are
 * what the move that spawns one loads ($01:84B3), drawn in that resource's
 * palette, and how long each frame is up is his recording (ADR 0036).
 * Goku's are still by hand (`GOKU.objects`) until his recording exists.
 */

import { stepStarts } from "./animation";
import { scriptAt, type FighterTables, type SpawnDef } from "./cartridge";
import { handlerAt, handlerFacts } from "./handler";
import { fullestLife, type Life } from "./recording";
import { resourcePalette, type Load } from "./resource";
import type { FighterName } from "./roster";
import { readScript } from "./script";

/** What only a person can say about an object: what to call it, and whether it hits. */
export interface OwnObject {
  name: string;
  type: number;
  anim: number;
  /** A projectile: a hit box over its whole picture. */
  hits: boolean;
}

/**
 * Named by what they are (ADR 0037), as the owner knows the moves — never
 * guessed from a picture (`npm run rom -- object`); which move puts one out
 * is the cartridge's to say.
 */
export const OWN_OBJECTS: Partial<Record<FighterName, OwnObject[]>> = {
  vegeta: [
    // ad, the Big Bang shot upward: a flash at the hands as it fires (its blow
    // is "other", damage 0), then the ball, which flies up and forward
    { name: "vegeta_flash", type: 0x1, anim: 0x3, hits: false },
    { name: "vegeta_big_bang", type: 0x1, anim: 0x4, hits: true },
  ],
};

/** Each object as the export draws it: tiles and palette from code, timing from `lives`. */
export function ownObjects(rom: Uint8Array, t: FighterTables, wanted: OwnObject[], lives: Life[]): SpawnDef[] {
  return wanted.map((o) => {
    const what = `${o.name} (${o.type.toString(16)}/${o.anim.toString(16)})`;
    const life = fullestLife(lives, o.type, o.anim);
    if (!life) throw new Error(`${what} is not in the recording`);
    const loads = spawnerLoads(rom, t, o.type, o.anim);
    if (loads.length === 0) throw new Error(`${what}: the move that spawns it loads no tiles`);
    return {
      name: o.name,
      type: o.type,
      anim: o.anim,
      steps: life.steps.map((s) => s.dur),
      frames: life.steps.map((s) => s.frame),
      // a life ends, so the recording shows it once through; a loop is the code's to say
      loop: false,
      hits: o.hits,
      // the resource's record names the first of a run of palettes the game
      // steps OBJ palette 0 through while the object is up (docs/rom.md)
      palette: resourcePalette(rom, loads[0].resource),
      loads,
    };
  });
}

/**
 * What the first move whose script spawns `type`/`anim` loads for player one.
 * The handler loads each resource once per player, P1's at the lower address
 * ($6C00, P2's $7C00), and an object's tiles count from P1's.
 */
function spawnerLoads(rom: Uint8Array, t: FighterTables, type: number, anim: number): Load[] {
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
    return [...lowest].map(([resource, vram]) => ({ resource, vram }));
  }
  throw new Error(`no move spawns object ${type.toString(16)}/${anim.toString(16)}`);
}
