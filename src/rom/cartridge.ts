/**
 * Where things are in the owner's dump — the one place an address in the ROM
 * is written down, so a second fighter is a second entry here and not a hunt
 * through the code. How each was found: docs/rom.md.
 */

/** BYOA: the owner's own dump, never in git (ADR 0016). */
export const ROM_PATH = "raw/rom/Dragon Ball Z - Hyper Dimension (tr).sfc";

export interface FighterTables {
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
}

export const GOKU: FighterTables = {
  layouts: 0x4880e,
  tileSets: 0x48a54,
  drawings: (0x48a54 - 0x4880e) / 3,
  tileRecords: 0x40b00,
  palette: 0xb0000,
  scripts: 0,
  boxes: 0x1d8000,
};

/**
 * A CPU address as an offset into the file, or null where the bus is not ROM.
 * Banks $00-$3F and $80-$BF are LoROM, both onto the first 2 MB: the handler
 * pointers name $8F and land in code that reads the fighter block, so this
 * game leaves the SA-1's mapping registers at a setting that mirrors them.
 * Banks $C0-$FF map the whole file linearly.
 */
export function toFile(address: number): number | null {
  const bank = address >> 16;
  const addr = address & 0xffff;
  if (bank >= 0xc0) return (bank - 0xc0) * 0x10000 + addr;
  if ((bank & 0x7f) < 0x40 && addr >= 0x8000) return (bank & 0x3f) * 0x8000 + (addr - 0x8000);
  return null;
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
  0x25: "busy (0x80 while a move runs)",
  0x40: "move",
  0x41: "script set (which fighter's scripts)",
  0x44: "frames since the move began",
  0x46: "step",
  0x6c: "attacks fired so far this move (script a0)",
  0x6d: "effects fired so far this move (script a1)",
  0x7c: "vx",
  0x7e: "vy",
  0x90: "tile set",
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
