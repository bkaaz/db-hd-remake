/**
 * A fighter's own objects — a special's shot, its flash, a beam's head and
 * base — as spawn defs. The tiles are what the move that spawns one loads
 * ($01:84B3), the colours the palette its code loads ($01:84EF); which
 * frames it shows is his recording (ADR 0036). How long each is up is the recording's too, unless
 * the object's code says it: a game that slows down under a beam stretches
 * what the recording shows (rom.md, Final Flash). Goku's are still by hand
 * (`GOKU.objects`) until his recording exists.
 */

import { toFile, type FighterTables, type SpawnDef } from "./cartridge";
import { spawnerLoads } from "./objectTiles";
import { fullestLife, type Life } from "./recording";
import { paletteRecord, type Load } from "./resource";
import type { FighterName } from "./roster";

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
  /** Drawn in its thrower's own palette: the record it takes as player two's alternate colours. */
  alt?: number;
  /** How many records after `palette` its code steps through, one every 4 frames ($01:84EF, `$0F:BA7F`). */
  shimmer?: number;
  /** Records its palette passes through as it comes out, for its `paletteAt` to name (`shimmer1` …). */
  fades?: number[];
  /**
   * Its tiles where its move's own load is not all of them: what the
   * recording's VRAM snapshot holds under its tile numbers
   * (`npm run rom -- vram`), named in the cartridge.
   */
  loads?: Load[];
  /** Its tile base, for an object its code puts out rather than a script's `b0`. */
  tiles?: number;
  /**
   * Its code shows a frame a tick from a table, `length` bytes at `at` (a CPU
   * address): its timing, whole — gone at the end, or round again if `loop`.
   */
  ticks?: { at: number; length: number; loop?: true };
  /** Its code plays a way in, a loop and a way out (`SpawnDef.animations`). */
  animations?: SpawnDef["animations"];
  vflip?: SpawnDef["vflip"];
  /**
   * The moves that put it out on their step rather than cut a part for it:
   * one that never hits and ends with its animation is an effect (Big Bang's
   * flash, `SpawnDef.onStep`).
   */
  onStep?: number[];
}

/**
 * Named by what they are (ADR 0037), as the owner knows the moves — never
 * guessed from a picture (`npm run rom -- object`); which move puts one out
 * is the cartridge's to say.
 */
/** What his a9, ab and b1 draw from: their own 0x4F, and 0x48 always beneath it. */
const WITH_48: Load[] = [{ resource: 0x48, vram: 0x6800 }, { resource: 0x4f, vram: 0x6c00 }];

/** What Gotenks's ae draws from: the 0x49 it loads, and 0x40 always beneath it. */
const VOLLEYBALL: Load[] = [{ resource: 0x40, vram: 0x6800 }, { resource: 0x49, vram: 0x6b00 }];

export const OWN_OBJECTS: Partial<Record<FighterName, OwnObject[]>> = {
  gotenks: [
    // ad, Ghosts Kamikaze Attack: palette 0x23 in OBJ palette 0, and tiles in 0x40 as
    // well as the 0x4A its move loads, on top of it (logs/objects-gotenks.bin);
    // up to three by how long A is held; its flight is in its states.json ($0F:C328)
    { name: "gotenks_ghost", type: 0x3, anim: 0x6, hits: true, palette: 0x23, loads: [{ resource: 0x40, vram: 0x6800 }, { resource: 0x4a, vram: 0x6b00 }] },
    // 3f, his intro after 3c: discharges on him, 36 frames in every 84 ($0F:C129, a frame every 4),
    // in his own colours: the intro's OBJ palette 4 is 0x70, what a fight puts there is not
    { name: "gotenks_discharge", type: 0x3, anim: 0xb, hits: false, palette: 0x70, alt: 0x71, loads: VOLLEYBALL, tiles: 0x80, onStep: [0x3f],
      animations: { play: { frames: [...Array(12).fill(9), 0, 1, 2, 3, 4, 5, 6, 7, 8], dur: 4, loop: true } } },
    // 3e, his win: Goten and Trunks come out of him while his own drawing is empty, each drawn
    // from his sprite's tiles, flying apart (script: b0 at -7 and -10). OBJ palette 4 goes 0x139,
    // 0x158, 0x160 and stays 0x168, by his handler's frames 87, 93, 99 (a run's CGRAM)
    { name: "gotenks_goten", type: 0x3, anim: 0xc, hits: false, palette: 0x168, alt: 0x169, fades: [0x139, 0x158, 0x160], animations: { play: { frames: [0], dur: 9999, loop: false } } },
    { name: "gotenks_trunks", type: 0x3, anim: 0xd, hits: false, palette: 0x168, alt: 0x169, fades: [0x139, 0x158, 0x160], animations: { play: { frames: [0], dur: 9999, loop: false } } },
    // ae, Volleyball: the ball and its shadow, shown frame by frame by `match/ball.ts`;
    // the shadow in palette 0x74, OBJ palette 4 (logs/objects-gotenks.bin)
    { name: "gotenks_ball", type: 0x3, anim: 0x4, hits: false, palette: 0x23, loads: VOLLEYBALL, tiles: 0x80, animations: { play: { frames: [0, 1], dur: 9999, loop: false } } },
    { name: "gotenks_ball_shadow", type: 0x3, anim: 0xe, hits: false, palette: 0x74, loads: VOLLEYBALL, tiles: 0x80, animations: { play: { frames: [0, 1, 2], dur: 9999, loop: false } } },
  ],
  gohan: [
    // ad, Masenko: its move loads nothing; its tiles are in resource 0x46, there
    // from the fight's start at $6800 and $7800, a player each (the recording's
    // slot says base 0x18: player two's 0x180, the script's +0x80 and his 0x100).
    // Palette 0x10E and the four after it, stepped every 4th frame ($0F:BF6D);
    // its two frames by $74 bit 2, gone at 80 ($0F:BF4C)
    { name: "gohan_masenko", type: 0x2, anim: 0x3, hits: true, palette: 0x10e, shimmer: 4, loads: [{ resource: 0x46, vram: 0x6800 }] },
    // 3c, his intro: effects put out on its step, nothing they do but show.
    // Drawn from his own sprite, palette 0x117 / his own, the recording's frames
    { name: "gohan_intro_a", type: 0x2, anim: 0x5, hits: false, palette: 0x117, onStep: [0x3c] },
    { name: "gohan_intro_b", type: 0x2, anim: 0x6, hits: false, palette: 0x60, alt: 0x61, onStep: [0x3c] },
  ],
  vegeta: [
    // ad, the Big Bang shot upward: a flash at the hands as it fires (its blow
    // is "other", damage 0), then the ball, which flies up and forward and
    // steps palettes 0x11C–0x120 ($0F:BAAC); the flash loads none and shows
    // what OBJ palette 0 holds — the ball's, taken here `?`
    { name: "vegeta_flash", type: 0x1, anim: 0x3, hits: false, palette: 0x11c, onStep: [0xad] },
    // a9, ab, b1: tiles from +0x80, which reach below $6C00 into resource
    // 0x48 at $6800, there in every snapshot; palette 0x11C (0x27BD24 in
    // CGRAM, logs/objects-vegeta.bin; a9 loads it at $20:99F2)
    // a9's flare shows a frame a tick from $0F:BA07 for 66 ticks ($0F:B9E7),
    // its timer stopped in a hitstop; re-armed every 32nd frame of the game
    // while its thrower is still in a9, gone when he is not ($0F:B9C0)
    { name: "vegeta_ground_flare", type: 0x1, anim: 0x2, hits: true, palette: 0x11c, loads: WITH_48, ticks: { at: 0x0fba07, length: 0x42 } }, // a9
    // ab's field: a frame a tick from $0F:BBD6, gone at 27 ($0F:BB6A)
    { name: "vegeta_energy_field", type: 0x1, anim: 0x7, hits: true, palette: 0x11c, loads: WITH_48, ticks: { at: 0x0fbbd6, length: 0x1b } }, // ab
    // b1's shot: a frame a tick from $0F:BB49, round and round ($0F:BB25);
    // falls at b0's vy 4 until its y is b8, then becomes a/02 ($0F:BB05)
    { name: "vegeta_vertical_ki", type: 0x1, anim: 0x6, hits: true, palette: 0x11c, shimmer: 4, loads: WITH_48, ticks: { at: 0x0fbb49, length: 4, loop: true } }, // b1
    { name: "vegeta_big_bang", type: 0x1, anim: 0x4, hits: true, palette: 0x11c, shimmer: 4 },
    // ae → af / b2's shots, 1/0e and 1/0f: Vertical Ki's drawings and code
    // ($0F:BE95 into $0F:BB31), their blow "other" for 0 — one spawn for both,
    // no hit box: the pinned opponent they fall around can't be hit anyway
    { name: "vegeta_gunfire_shot", type: 0x1, anim: 0xe, hits: false, palette: 0x11c, shimmer: 4, loads: WITH_48, ticks: { at: 0x0fbb49, length: 4, loop: true } }, // af, b2
    // 9e's and a8's sprays: where they are put, a frame a tick from $0F:BC3A /
    // $0F:BC95, gone at 17 / 22 or when he leaves the move ($0F:BBF1, BC4C);
    // drawn from his own sprite, which neither move loads anything over
    { name: "vegeta_jumping_bomb", type: 0x1, anim: 0x8, hits: true, palette: 0x11c, ticks: { at: 0x0fbc3a, length: 0x11 } }, // 9e
    { name: "vegeta_energy_dash", type: 0x1, anim: 0x9, hits: true, palette: 0x11c, ticks: { at: 0x0fbc95, length: 0x16 } }, // a8
    // ac, Final Flash: its heads step every 4th frame of the game ($0F:BDF4,
    // BE0C, BE2C), its base every 4 frames — 0–1 in, 2–4 while the head is
    // up, 5–6 out ($0F:BD2E). The heads load palettes 0x130–0x133 by $74
    // ($0F:BE3D) into the palette the base draws in too: both step the run.
    // The small head shows ($74 & 0C) / 4, the others count to 5 / 6 and
    // wrap: frames 0 to n - 1, 4 each
    ...([["s", 0xb, 4], ["m", 0xc, 5], ["l", 0xd, 6]] as const).map(([size, anim, n]) => ({
      name: `vegeta_final_flash_${size}`, type: 0x1, anim, hits: true, palette: 0x130, shimmer: 3,
      animations: { play: { frames: [...Array(n).keys()], dur: 4, loop: true } },
    })),
    {
      name: "vegeta_final_flash_base", type: 0x1, anim: 0xa, hits: false, palette: 0x130, shimmer: 3,
      animations: {
        in: { frames: [0, 1], dur: 4, loop: false },
        loop: { frames: [2, 3, 4], dur: 4, loop: true },
        out: { frames: [5, 6], dur: 4, loop: false },
      },
    },
  ],
};

/**
 * `wanted` split by whether it can be exported: timed by its code (`ticks`,
 * `animations`), or held by `lives` — what a recording can export, and what it missed.
 */
export function inRecording(wanted: OwnObject[], lives: Life[]): { recorded: OwnObject[]; missed: OwnObject[] } {
  const has = (o: OwnObject) => !fromRecording(o) || fullestLife(lives, o.type, o.anim) !== undefined;
  return { recorded: wanted.filter(has), missed: wanted.filter((o) => !has(o)) };
}

/** Whether an object's frames and timing are the recording's, its code having none to give. */
function fromRecording(o: OwnObject): boolean {
  return !o.ticks && !o.animations;
}

/** Each object as the export draws it: tiles from what its move loads, frames from its code or `lives`. */
export function ownObjects(rom: Uint8Array, t: FighterTables, wanted: OwnObject[], lives: Life[]): SpawnDef[] {
  return wanted.map((o) => {
    const what = `${o.name} (${o.type.toString(16)}/${o.anim.toString(16)})`;
    const loads = o.loads ?? spawnerLoads(rom, t, o.type, o.anim);
    if (loads.length === 0) throw new Error(`${what}: the move that spawns it loads no tiles`);
    return {
      name: o.name,
      type: o.type,
      anim: o.anim,
      ...timing(rom, o, lives, what),
      hits: o.hits,
      palette: paletteRecord(rom, o.palette).at,
      ...(o.alt && { alt: paletteRecord(rom, o.alt).at }),
      ...(o.vflip && { vflip: o.vflip }),
      ...(o.tiles !== undefined && { tiles: o.tiles }),
      ...(o.fades && { shimmer: o.fades.map((id) => paletteRecord(rom, id).at) }),
      ...(o.shimmer && { shimmer: Array.from({ length: o.shimmer }, (_, i) => paletteRecord(rom, o.palette + 1 + i).at) }),
      loads,
    };
  });
}

function timing(rom: Uint8Array, o: OwnObject, lives: Life[], what: string) {
  if (o.ticks) return fromTicks(rom, o.ticks);
  if (o.animations) return { steps: [], animations: o.animations, loop: false };
  const life = fullestLife(lives, o.type, o.anim);
  if (!life) throw new Error(`${what} is not in the recording`);
  // a life ends, so the recording shows it once through
  return { steps: life.steps.map((s) => s.dur), frames: life.steps.map((s) => s.frame), loop: false };
}

/** A table of the frame shown each tick, as steps: one a run of the same frame. */
export function fromTicks(
  rom: Uint8Array,
  { at, length, loop }: { at: number; length: number; loop?: true },
): { steps: number[]; frames: number[]; loop: boolean } {
  const start = toFile(at);
  if (start === null) throw new Error(`${at.toString(16)} is not ROM`);
  const steps: number[] = [];
  const frames: number[] = [];
  for (const frame of rom.subarray(start, start + length)) {
    if (frames[frames.length - 1] === frame) steps[steps.length - 1]++;
    else (frames.push(frame), steps.push(1));
  }
  return { steps, frames, loop: loop ?? false };
}

