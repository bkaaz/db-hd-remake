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
  /** 2 bytes per drawing id: the resource its tiles are, 0 for a drawing not used. */
  tileSets: number;
  /** How many drawing ids the two tables above cover. */
  drawings: number;
  /** 16 BGR555 colours: player one, daytime stage (PalMod). */
  palette: number;
  /** Which entry of the script tables is this fighter's (fighter field 0x41). */
  scripts: number;
  /** 32 bytes per drawing id: its boxes (src/rom/collision.ts). */
  boxes: number;
  /** The objects this fighter spawns that we export, and what they draw from. */
  objects: Objects;
  /** Other palettes the whole sheet is drawn in too, by name — sheet `<name>@<variant>.png`. */
  variants?: Record<string, number>;
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
  /** Frames each step stays up, in order — the object's code decides, read there or recorded. */
  steps: number[];
  /** Which of the object's frames each step shows, when not 0, 1, 2… */
  frames?: number[];
  /**
   * Named animations in place of the one `play` that `steps` makes — an object
   * whose code plays a way in, a loop and a way out ($0F:E70F): the object's
   * frames each shows, frames each is held, and whether it repeats.
   */
  animations?: Record<string, { frames: number[]; dur: number; loop: boolean }>;
  loop: boolean;
  /** Give each frame a hit box over its picture — a projectile. */
  hits: boolean;
  /**
   * A ROM palette to draw with instead of the one its OAM slot holds — for an
   * object whose slot is swapped while it is up, which a snapshot taken
   * without it on screen cannot show.
   */
  palette?: number;
  /** What the move loads into VRAM for this object, in place of the fighter's `loads`. */
  loads?: { resource: number; vram: number }[];
}

/** Resource 0x32's palette ($95:DE1C, its record) and where the charged Kamehameha loads its tiles. */
const KAME_PALETTE = 0x2ade1c;
const KAME_LOADS = [{ resource: 0x32, vram: 0x6c00 }];

/** The fire a Kamehameha leaves on whoever it hits: 15 palettes of 32 bytes from $95:C78E (docs/rom.md). */
const FIRE = Object.fromEntries(Array.from({ length: 15 }, (_, n) => [`fire${n}`, 0x2ac78e + 32 * n]));

/**
 * The explosions' frames ($0F:E2A9), tiles — resource 0x30 at $6500 for the
 * first flash, 0x31 at $7500 for the rest, matched against a VRAM snapshot
 * (2026-10-30) — and resource 0x31's own palette, the one in OAM slot 2.
 */
const BURST_STEPS = [6, 8, 3, 4, 3, 3, 3];
const BURST_LOADS = [{ resource: 0x30, vram: 0x6500 }, { resource: 0x31, vram: 0x7500 }];
const BURST_PALETTE = 0x27ae98;

export const GOKU: FighterTables = {
  character: 0,
  variants: FIRE,
  layouts: 0x4880e,
  tileSets: 0x48a54,
  drawings: (0x48a54 - 0x4880e) / 3,
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
      // the charged Kamehameha's beam head, one per charge (aa, $20:8447): its
      // frame flips every 4 frames of the global counter ($0F:E601), drawn
      // from resource 0x32 the move loads at $6C00, in that resource's palette
      ...[0x13, 0x14, 0x15].map((anim, i) => ({
        name: `goku_kame_${["s", "m", "l"][i]}`, type: 0xa, anim, steps: [4, 4], loop: true, hits: true,
        palette: KAME_PALETTE, loads: KAME_LOADS,
      })),
      // its base at the hands ($0F:E613): a step every 4 frames ($0F:E70F) —
      // 0–1 in, 2–4 looped while the beam is drawn ($0F:E738), 5–7 out, gone at 8
      { name: "goku_kame_base", type: 0xa, anim: 0x16, steps: [], loop: false, hits: false,
        palette: KAME_PALETTE, loads: KAME_LOADS,
        animations: {
          in: { frames: [0, 1], dur: 4, loop: false },
          loop: { frames: [2, 3, 4], dur: 4, loop: true },
          out: { frames: [5, 6, 7], dur: 4, loop: false },
        } },
      // what a projectile becomes where it hits ($2A:8E31): no script spawns
      // these, so their tiles count from 0 ($2A:8F84 clears the base); all
      // step through $0F:E2A9 and are gone
      ...([["goku_burst", 0x01], ["goku_kame_burst_s", 0x02], ["goku_kame_burst_m", 0x17], ["goku_kame_burst_l", 0x18]] as const).map(
        ([name, anim]) => ({ name, type: 0xa, anim, steps: BURST_STEPS, loop: false, hits: false, palette: BURST_PALETTE, loads: BURST_LOADS }),
      ),
      // the dust a body raises hitting the floor ($0D:DE6C, from the knockdown
      // handler): 6 frames a step ($0F:E559), in the explosions' slot and tiles
      { name: "goku_dust", type: 0xa, anim: 0x0d, steps: [6, 6, 6, 6], loop: false, hits: false, palette: BURST_PALETTE, loads: BURST_LOADS },
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
  0x1f: "x, fraction",
  0x20: "x, whole px",
  0x22: "y, fraction",
  0x23: "y, whole px (200 on the ground)",
  0x25: "busy (0x80 while a move runs)",
  0x27: "bit 0: the camera does not follow vertically (cleared on landing)",
  0x33: "vy at the last landing",
  0x40: "move",
  0x41: "script set (which fighter's scripts)",
  0x44: "frames since the move began",
  0x46: "step",
  0x60: "health",
  0x62: "health's ceiling (charging ki refills to it)",
  0x64: "ki ?",
  0x68: "stun gauge (20, dizzy at 0)",
  0x6a: "attack (ATTACK option)",
  0x6b: "defence (option + fighter's own)",
  0x6c: "sounds played so far this move (script a0)",
  0x6d: "effects fired so far this move (script a1)",
  0x78: "damage of the last blow taken",
  0x7c: "vx",
  0x7e: "vy",
  0x86: "gravity, added to vy each frame in the air",
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

export function layoutAt(t: FighterTables, id: number): number {
  return t.layouts + 3 * id;
}

/**
 * The resource a drawing's tiles are — Goku's `0x1xx`, the next fighter's
 * `0x2xx` — or null if the drawing is unused (`rom.md`, Another fighter).
 */
export function tileResourceOf(rom: Uint8Array, t: FighterTables, drawing: number): number | null {
  if (drawing >= t.drawings) throw new Error(`drawing ${drawing} is past the table's ${t.drawings}`);
  const at = t.tileSets + 2 * drawing;
  return rom[at] | (rom[at + 1] << 8) || null;
}
