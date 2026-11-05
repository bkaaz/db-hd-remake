import { hitFields, objectHit } from "./objectHit";
import { existsSync, readFileSync } from "node:fs";
import type { StatesFile } from "../entity/states";
import { toFile, type FighterTables } from "./cartridge";
import { readLayout } from "./frame";
import { handlerAt } from "./handler";
import { objectFrame } from "./object";
import { objectEntry, objectFacts } from "./objectCode";
import { spawnerLoads } from "./objectTiles";
import type { OwnObject } from "./ownObjects";
import type { PartReport } from "./port";

/**
 * A fighter's own object with no recording yet (ADR 0036 wants one): all the
 * code gives, and a guess at the rest. Its frames are what its table holds,
 * shown 4 frames each `?`; its tiles what stays at `$6800` all fight with what
 * its move loads over it, a picture reaching both; its colours the first palette its handler or its code
 * loads, or else his own. A recording replaces the lot: `OWN_OBJECTS`.
 */

/** `$01:848B`: the resource each fighter keeps at `$6800`, a 2-byte id each. */
const AT_6800 = 0x01848b;
const OWN_PALETTES = 0x40;
/** How far past a handler's start a palette load is looked for. */
const REACH = 0x200;
const MOST_FRAMES = 24;
const LIFE = /from frame (\d+)/;

export type Spawned = PartReport["spawns"][number];

export function objectName(fighter: string, s: { type: number; anim: number }): string {
  return `${fighter}_${s.type.toString(16)}_${s.anim.toString(16).padStart(2, "0")}`;
}

/**
 * The frames its table holds: as far as each is a layout in the first one's
 * bank, an empty one among them being how an object shows nothing for a
 * while — but none past its last picture.
 */
export function framesOf(rom: Uint8Array, type: number, anim: number): number[] {
  const out: number[] = [];
  let pictures = 0;
  try {
    const bank = objectFrame(rom, type, anim, 0) >> 16;
    for (let step = 0; step < MOST_FRAMES; step++) {
      const at = objectFrame(rom, type, anim, step);
      if (at >> 16 !== bank) break;
      out.push(step);
      if (readLayout(rom, at).length > 0) pictures = out.length;
    }
  } catch {
    // the table's end: what is past it is no pointer, or no layout
  }
  return out.slice(0, pictures);
}

/** The first `LDA #record : JSL $01:84EF` from `entry` on. */
function paletteLoad(rom: Uint8Array, entry: number): number | null {
  const start = toFile(entry);
  if (start === null) return null;
  for (let p = start; p < start + REACH; p++) {
    if (rom[p] === 0xa9 && rom[p + 3] === 0x22 && rom[p + 4] === 0xef && rom[p + 5] === 0x84 && rom[p + 6] === 0x01) {
      return rom[p + 1] | (rom[p + 2] << 8);
    }
  }
  return null;
}

export function draftObject(rom: Uint8Array, t: FighterTables, fighter: string, move: number, s: Spawned): OwnObject | null {
  const frames = framesOf(rom, s.type, s.anim);
  if (frames.length === 0) return null;
  const loads = spawnerLoads(rom, t, s.type, s.anim);
  const at6800 = toFile(AT_6800 + 2 * t.character)!;
  const kept = { resource: rom[at6800] | (rom[at6800 + 1] << 8), vram: 0x6800 };
  const overIt = loads.some((l) => l.vram > kept.vram);
  const palette = paletteLoad(rom, handlerAt(rom, t.character, move)) ?? paletteLoad(rom, objectEntry(rom, s.type)) ?? OWN_PALETTES + 16 * t.character;
  return {
    name: objectName(fighter, s),
    type: s.type,
    anim: s.anim,
    hits: s.blow.damage > 0,
    palette,
    loads: loads.length === 0 ? [kept] : overIt ? [kept, ...loads] : loads,
    animations: { play: { frames, dur: 4, loop: true } },
  };
}

/** Its `states.json`: flying at `b0`'s speed for as long as its code says, with the blow of the objects' table. */
export function objectStates(rom: Uint8Array, s: Spawned, knownType: (type: string) => boolean): StatesFile {
  const life = objectFacts(rom, s.type, s.anim).flatMap((f) => [...(f.from !== undefined ? [f.from] : []), ...(f.when ?? []).map((w) => Number(LIFE.exec(w)?.[1] ?? NaN))]);
  const lasts = life.find((n) => Number.isFinite(n) && n > 0);
  const strikes = s.blow.damage > 0 && knownType(s.blow.type);
  const { file, state } = hitFields(objectHit(rom, s.type, s.anim));
  const blow = strikes ? { type: s.blow.type, damage: s.blow.damage, ...state } : {};
  const flight = s.vy !== 0 ? { airborne: true, launch: [s.vx, s.vy] } : { vel: [s.vx, 0] };
  return { initial: "fly", ...(strikes && file), states: { fly: { anim: "play", turn: false, ...flight, ...(lasts && { lasts }), ...blow } } } as unknown as StatesFile;
}

/** The objects `draft` left for his export, beside his `specials.json`. */
export function draftedObjects(fighter: string): OwnObject[] {
  const path = `data/entities/${fighter}/objects.json`;
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as OwnObject[]) : [];
}
