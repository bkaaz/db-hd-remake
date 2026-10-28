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
}

export const GOKU: FighterTables = {
  layouts: 0x4880e,
  tileSets: 0x48a54,
  drawings: (0x48a54 - 0x4880e) / 3,
  tileRecords: 0x40b00,
  palette: 0xb0000,
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
  0x0a: "drawing",
  0x25: "busy (0x80 while a move runs)",
  0x40: "move",
  0x44: "step timer? (a step ends when $44/$45 reach 0)",
  0x46: "step",
  0x6c: "phase?",
  0x7c: "vx",
  0x7e: "vy",
  0x90: "tile set",
};

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
