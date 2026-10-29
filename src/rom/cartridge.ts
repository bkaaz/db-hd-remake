/**
 * Where things are in the owner's dump — the one place an address in the ROM
 * is written down, so a second fighter is a second entry here and not a hunt
 * through the code. How each was found: docs/rom.md.
 */

/** BYOA: the owner's own dump, never in git (ADR 0016). */
export const ROM_PATH = "raw/rom/Dragon Ball Z - Hyper Dimension (tr).sfc";

export interface FighterTables {
  /** Fighter field 0x00: the index of the tables reached by it — hits, attributes, close lines. */
  character: number;
  /** 3-byte LoROM pointers, one per drawing id (fighter field `0x0a`). */
  layouts: number;
  /** 2 bytes per drawing id: its tile set, then 1 if the drawing is used. */
  tileSets: number;
  /** How many drawing ids the two tables above cover. */
  drawings: number;
  /** 11-byte records, one per tile set (fighter field `0x90`); first 3 bytes
   *  point at a compressed stream, a record of `ff` is an unused slot. */
  tileRecords: number;
  /** 16 BGR555 colours: player one, daytime stage (PalMod). */
  palette: number;
  /** Which entry of the script tables is this fighter's (fighter field 0x41). */
  scripts: number;
  /** 32 bytes per drawing id: its boxes (src/rom/collision.ts). */
  boxes: number;
  /** The objects this fighter spawns that we export, and what they draw from. */
  objects: Objects;
}

/**
 * Where a fighter's objects get their pictures and timing. The loads and the
 * palettes were matched against a VRAM snapshot, the frame timings read off a
 * recording of the object slots (docs/rom.md, 2026-10-29) — the object's own
 * code holds them, not its data.
 */
export interface Objects {
  /** Resources in OBJ VRAM, as the game loads them before a fight. */
  loads: { resource: number; vram: number }[];
  /** ROM palette for each OAM palette slot an object uses. */
  palettes: Record<number, number>;
  spawns: SpawnDef[];
}

export interface SpawnDef {
  /** The spawn entity's name, under data/spawns/. */
  name: string;
  type: number;
  anim: number;
  /** Frames each step stays up, in order — the object's code decides, so recorded. */
  steps: number[];
  loop: boolean;
  /** Give each frame a hit box over its picture — a projectile. */
  hits: boolean;
  /**
   * A ROM palette to draw with instead of the one its OAM slot holds — for an
   * object whose slot is swapped while it is up, which a snapshot taken
   * without it on screen cannot show.
   */
  palette?: number;
}

export const GOKU: FighterTables = {
  character: 0,
  layouts: 0x4880e,
  tileSets: 0x48a54,
  drawings: (0x48a54 - 0x4880e) / 3,
  tileRecords: 0x40b00,
  palette: 0xb0000,
  scripts: 0,
  boxes: 0x1d8000,
  objects: {
    loads: [
      { resource: 0x31, vram: 0x7500 },
      { resource: 0x51, vram: 0x6c00 },
    ],
    palettes: { 2: 0x1b4ea, 4: 0x27b161 },
    spawns: [
      // slot 2 holds 0x1b4ea whenever no blast is up, and that drew it green
      // and flashing black in play (2026-10-29); PalMod names 0x27B161 the
      // "KI Blast effects" palette
      { name: "goku_ki", type: 0xa, anim: 3, steps: [2, 2], loop: true, hits: true, palette: 0x27b161 },
      { name: "goku_hair", type: 0, anim: 5, steps: [32, 8, 8, 6], loop: false, hits: false },
    ],
  },
};

/**
 * A CPU address as an offset into the file, or null where the bus is not ROM.
 * The SA-1's default mapping: banks $00-$1F, $20-$3F, $80-$9F and $A0-$BF are
 * LoROM onto the file's four megabytes in that order, and $C0-$FF map the
 * whole file linearly. ($8F:B161 is PalMod's 0x27B161, the hair palette.)
 */
export function toFile(address: number): number | null {
  const bank = address >> 16;
  const addr = address & 0xffff;
  if (bank >= 0xc0) return (bank - 0xc0) * 0x10000 + addr;
  if ((bank & 0x7f) >= 0x40 || addr < 0x8000) return null;
  const megabyte = (bank & 0x80 ? 2 : 0) + ((bank >> 5) & 1); // $00 $20 $80 $A0 → 0 1 2 3
  return megabyte * 0x100000 + (bank & 0x1f) * 0x8000 + (addr - 0x8000);
}

/** A 3-byte address (lo, hi, bank) read as an offset into the file. */
export function pointer(rom: Uint8Array, at: number): number {
  const off = toFile(rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16));
  if (off === null) throw new Error(`not a ROM address at 0x${at.toString(16)}`);
  return off;
}

/**
 * The fighter block: SA-1 I-RAM, player one at $3100 and two at $3200, the
 * same field at the same offset. Code reaches it as `$46,X` with X = $3100.
 * `?` marks a reading that one recording suggested and nothing has checked.
 */
export const FIGHTER_FIELDS: Record<number, string> = {
  0x00: "character (indexes per-fighter tables)",
  0x03: "x",
  0x07: "y",
  0x0a: "drawing",
  0x0e: "draw offset x (script d0)",
  0x10: "draw offset y (script d0)",
  0x12: "facing (bit 6: left)",
  0x14: "flip, XORed with the facing (script e0)",
  0x20: "x, whole px",
  0x23: "y, whole px (200 on the ground)",
  0x25: "busy (0x80 while a move runs)",
  0x40: "move",
  0x41: "script set (which fighter's scripts)",
  0x44: "frames since the move began",
  0x46: "step",
  0x60: "health",
  0x62: "health at the start ?",
  0x64: "ki ?",
  0x68: "stun gauge (20, dizzy at 0)",
  0x6a: "attack (ATTACK option)",
  0x6b: "defence (option + fighter's own)",
  0x6c: "sounds played so far this move (script a0)",
  0x6d: "effects fired so far this move (script a1)",
  0x78: "damage of the last blow taken",
  0x7c: "vx",
  0x7e: "vy",
  0x88: "shove speed (knockback, 8.8)",
  0x8c: "shove frames left",
  0x90: "tile set",
  0x92: "move of the blow that hit",
  0x93: "step of the blow that hit",
};

/**
 * One 3-byte pointer per fighter, read by the script engine at $01:85FD: each
 * leads to that fighter's 16-bit script pointers, one per move id, in the
 * same bank. Ten are valid — the roster.
 */
const SCRIPT_TABLES = 0x88de;

/** Offset of the animation script a move plays. */
export function scriptAt(rom: Uint8Array, t: FighterTables, move: number): number {
  const at = SCRIPT_TABLES + 3 * t.scripts;
  const list = pointer(rom, at) + 2 * move;
  const off = toFile((rom[at + 2] << 16) | rom[list] | (rom[list + 1] << 8));
  if (off === null) throw new Error(`move 0x${move.toString(16)} has no script`);
  return off;
}

const RECORD = 11;

/** Offset of tile set `index`'s stream, or null for an unused slot. */
export function tileStream(rom: Uint8Array, t: FighterTables, index: number): number | null {
  const at = t.tileRecords + RECORD * index;
  if (rom[at] === 0xff && rom[at + 1] === 0xff && rom[at + 2] === 0xff) return null;
  return pointer(rom, at);
}

export function layoutAt(t: FighterTables, id: number): number {
  return t.layouts + 3 * id;
}

/** The tile set a drawing is cut from, or null if the drawing is unused. */
export function tileSetOf(rom: Uint8Array, t: FighterTables, drawing: number): number | null {
  if (drawing >= t.drawings) throw new Error(`drawing ${drawing} is past the table's ${t.drawings}`);
  const at = t.tileSets + 2 * drawing;
  return rom[at + 1] ? rom[at] : null;
}
