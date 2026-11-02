/**
 * A fighter's own objects — a special's shot, its flash, a beam's head and
 * base — as spawn defs. The tiles are what the move that spawns one loads
 * ($01:84B3), the colours the palette its code loads ($01:84EF); which
 * frames it shows is his recording (ADR 0036). How long each is up is the recording's too, unless
 * the object's code says it: a game that slows down under a beam stretches
 * what the recording shows (rom.md, Final Flash). Goku's are still by hand
 * (`GOKU.objects`) until his recording exists.
 */

import { stepStarts } from "./animation";
import { scriptAt, toFile, type FighterTables, type SpawnDef } from "./cartridge";
import { handlerAt, handlerFacts } from "./handler";
import { fullestLife, type Life } from "./recording";
import { paletteRecord, type Load } from "./resource";
import type { FighterName } from "./roster";
import { readScript } from "./script";

/** What a person says about an object: its name, whether it hits, and timing read from its code. */
export interface OwnObject {
  name: string;
  type: number;
  anim: number;
  /** A projectile: a hit box over its whole picture. */
  hits: boolean;
  /**
   * The palette record its code loads into OBJ palette 0 ($01:84EF) — the
   * first of the run it steps through while it is up (docs/rom.md).
   */
  palette: number;
  /** Its code steps through the frames the recording showed every `cycle` frames, round and round. */
  cycle?: number;
  /**
   * Its tiles where its move's own load is not all of them: what the
   * recording's VRAM snapshot holds under its tile numbers
   * (`npm run rom -- vram`), named in the cartridge.
   */
  loads?: Load[];
  /** Its code shows a frame a tick from a table, `length` bytes at `at` (a CPU address): its timing, whole. */
  ticks?: { at: number; length: number };
  /** Its code plays a way in, a loop and a way out (`SpawnDef.animations`). */
  animations?: SpawnDef["animations"];
}

/**
 * Named by what they are (ADR 0037), as the owner knows the moves — never
 * guessed from a picture (`npm run rom -- object`); which move puts one out
 * is the cartridge's to say.
 */
/** What his a9, ab and b1 draw from: their own 0x4F, and 0x48 always beneath it. */
const WITH_48: Load[] = [{ resource: 0x48, vram: 0x6800 }, { resource: 0x4f, vram: 0x6c00 }];

export const OWN_OBJECTS: Partial<Record<FighterName, OwnObject[]>> = {
  vegeta: [
    // ad, the Big Bang shot upward: a flash at the hands as it fires (its blow
    // is "other", damage 0), then the ball, which flies up and forward and
    // steps palettes 0x11C–0x120 ($0F:BAAC); the flash loads none and shows
    // what OBJ palette 0 holds — the ball's, taken here `?`
    { name: "vegeta_flash", type: 0x1, anim: 0x3, hits: false, palette: 0x11c },
    // a9, ab, b1: tiles from +0x80, which reach below $6C00 into resource
    // 0x48 at $6800, there in every snapshot; palette 0x11C (0x27BD24 in
    // CGRAM, logs/objects-vegeta.bin; a9 loads it at $20:99F2)
    // a9's flare shows a frame a tick from $0F:BA07 for 66 ticks ($0F:B9E7),
    // its timer stopped in a hitstop; re-armed every 32nd frame of the game
    // while its thrower is still in a9, gone when he is not ($0F:B9C0)
    { name: "vegeta_ground_flare", type: 0x1, anim: 0x2, hits: true, palette: 0x11c, loads: WITH_48, ticks: { at: 0x0fba07, length: 0x42 } }, // a9
    // ab's field: a frame a tick from $0F:BBD6, gone at 27 ($0F:BB6A)
    { name: "vegeta_energy_field", type: 0x1, anim: 0x7, hits: true, palette: 0x11c, loads: WITH_48, ticks: { at: 0x0fbbd6, length: 0x1b } }, // ab
    { name: "vegeta_vertical_ki", type: 0x1, anim: 0x6, hits: true, palette: 0x11c, loads: WITH_48 }, // b1
    { name: "vegeta_big_bang", type: 0x1, anim: 0x4, hits: true, palette: 0x11c },
    // ac, Final Flash: its heads step every 4th frame of the game ($0F:BDF4,
    // BE0C, BE2C), its base every 4 frames — 0–1 in, 2–4 while the head is
    // up, 5–6 out ($0F:BD2E); the heads step palettes 0x130–0x133 ($0F:BE3D)
    ...([["s", 0xb], ["m", 0xc], ["l", 0xd]] as const).map(([size, anim]) => (
      { name: `vegeta_final_flash_${size}`, type: 0x1, anim, hits: true, cycle: 4, palette: 0x130 }
    )),
    {
      name: "vegeta_final_flash_base", type: 0x1, anim: 0xa, hits: false, palette: 0x130,
      animations: {
        in: { frames: [0, 1], dur: 4, loop: false },
        loop: { frames: [2, 3, 4], dur: 4, loop: true },
        out: { frames: [5, 6], dur: 4, loop: false },
      },
    },
  ],
};

/** `wanted` split by whether `lives` holds each — what a recording can export, and what it missed. */
export function inRecording(wanted: OwnObject[], lives: Life[]): { recorded: OwnObject[]; missed: OwnObject[] } {
  const has = (o: OwnObject) => fullestLife(lives, o.type, o.anim) !== undefined;
  return { recorded: wanted.filter(has), missed: wanted.filter((o) => !has(o)) };
}

/** Each object as the export draws it: tiles from what its move loads, frames from `lives`. */
export function ownObjects(rom: Uint8Array, t: FighterTables, wanted: OwnObject[], lives: Life[]): SpawnDef[] {
  return wanted.map((o) => {
    const what = `${o.name} (${o.type.toString(16)}/${o.anim.toString(16)})`;
    const life = fullestLife(lives, o.type, o.anim);
    if (!life) throw new Error(`${what} is not in the recording`);
    const loads = o.loads ?? spawnerLoads(rom, t, o.type, o.anim);
    if (loads.length === 0) throw new Error(`${what}: the move that spawns it loads no tiles`);
    const shown = [...new Set(life.steps.map((s) => s.frame))].sort((a, b) => a - b);
    const timing =
      o.ticks ? fromTicks(rom, o.ticks)
      : o.animations ? { steps: [], animations: o.animations, loop: false }
      : o.cycle ? { steps: shown.map(() => o.cycle!), frames: shown, loop: true }
      // a life ends, so the recording shows it once through
      : { steps: life.steps.map((s) => s.dur), frames: life.steps.map((s) => s.frame), loop: false };
    return {
      name: o.name,
      type: o.type,
      anim: o.anim,
      ...timing,
      hits: o.hits,
      palette: paletteRecord(rom, o.palette).at,
      loads,
    };
  });
}

/** A table of the frame shown each tick, as steps: one a run of the same frame. */
export function fromTicks(rom: Uint8Array, { at, length }: { at: number; length: number }): { steps: number[]; frames: number[]; loop: false } {
  const start = toFile(at);
  if (start === null) throw new Error(`${at.toString(16)} is not ROM`);
  const steps: number[] = [];
  const frames: number[] = [];
  for (const frame of rom.subarray(start, start + length)) {
    if (frames[frames.length - 1] === frame) steps[steps.length - 1]++;
    else (frames.push(frame), steps.push(1));
  }
  return { steps, frames, loop: false };
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
