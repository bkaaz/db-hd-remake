import { FIGHTER_FIELDS, toFile } from "./cartridge";
import { storedTo, valueOf, type Value, type Who } from "./cpu";
import { FRAMES } from "./flow";
import { ROUTINES } from "./routines";
import { walk, type Body } from "./walk";

/**
 * A move's handler — the code `$0F:8000` runs every frame of the move — and
 * what can be read off it without running it: at which frame it sets which
 * speed, and which known routines it calls when. docs/rom.md, Where to start
 * a search, says how handlers are laid out.
 *
 * Read by following every branch with what it tells (`flow.ts`): the frame
 * a `CMP #n` on field 0x44 pins or bounds, what a routine answered in the
 * carry (`routines.ts`), the constants loaded before a call — and, for a
 * handler that jumps through a table by the script's step (field 0x46, as
 * the knockdown's `$0F:A217` does), the step each entry runs on. A test it
 * cannot read (a button held, a field of its own) leaves both ways open, so
 * a handler written another way reads as facts under fewer conditions,
 * never as wrong ones; the address is in the report for reading the rest by
 * hand.
 */

/** `$0F:8061`: a 2-byte pointer per fighter to 3-byte handler pointers by move. */
const HANDLERS = 0x0f8061;

export function handlerAt(rom: Uint8Array, character: number, move: number): number {
  const file = (address: number) => {
    const at = toFile(address);
    if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
    return at;
  };
  const table = file((HANDLERS & 0xff0000) | (rom[file(HANDLERS) + 2 * character] | (rom[file(HANDLERS) + 2 * character + 1] << 8)));
  const at = table + 3 * move;
  return rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16);
}

export interface HandlerFact {
  /** The frame of the move (field 0x44) the code was reached on; null when no comparison led there. */
  frame: number | null;
  /** The first frame it can be reached on, when only a `BCC`/`BCS` on the frame bounds it. */
  from?: number;
  /** What the code waits on, oldest first: a routine's answer ("once it has landed"), a test named (`tests.ts`). */
  when?: string[];
  what: string;
  /** A speed set, px per frame, facing right. */
  vx?: number;
  /** A sound played, as the cartridge's id. */
  sound?: number;
  /** The script step the code runs on, for a handler that jumps by step. */
  step?: number;
  /** The frame of the move it jumps to (field 0x44 set). */
  to?: number;
  /** The move it sets in its place. */
  move?: number;
  /** The spawn counter it sets (field 0x6e): which of the script's spawns fire. */
  counter?: number;
  /** The stage's shake it starts (`$E3`): which of `$0D:C593`'s patterns, for how many frames. */
  shake?: { pattern: number; frames: number };
  /** Whom it is done to, when not the mover itself: X or the store pointed at the opponent. */
  who?: Who;
  /** A facing set (field 0x12): to whose, and turned by what. */
  facing?: Value;
  /** Where `$0D:DE9A` holds the opponent from: its table of offsets. */
  hold?: number;
  /** A resource loaded into OBJ VRAM (`$01:84B3`), at a word address when the code says which. */
  load?: { resource: number; vram: number | null };
  /** `$0F:B321`'s throw: what it costs the opponent and how it leaves. */
  launch?: { damage: number; stun: number; move: number; vx: number; vy: number; facing: Value };
}


/** Field 0x6e: a `b0` fires only while it equals the command's counter (`script.ts`). */
const SPAWN_COUNTER = 0x6e;
const STEP = 0x46;
const VX = 0x7c;
const FACING = 0x12;
/** `$E3`, the stage's shake (`$0D:C558`): bit 15 on, bits 8–11 the pattern, the low byte frames. */
const SHAKE = 0xe3;

/**
 * A move's handler, as `walk` reads it. `steps`: how many steps the move's
 * script has — the length of a by-step table (field 0x46, as the
 * knockdown's `$0F:A217` jumps). `character`: whose handler it is, for code
 * shared by the roster that asks (charging's sound, `$0F:A020`).
 */
export function handlerFacts(rom: Uint8Array, entry: number, steps = 0, character?: number): HandlerFact[] {
  return walk(rom, entry, { ...FIGHTER, dispatch: { field: STEP, entries: [...Array(steps).keys()], tagged: true } }, character);
}

const FIGHTER: Omit<Body, "dispatch"> = {
  frames: FRAMES,
  names: FIGHTER_FIELDS,
  routines: ROUTINES,
  // banks holding move handlers and their helpers, not the engine
  ownBanks: new Set([0x0f, 0x10, 0x20]),
  stops: new Set(),
  observe(ins, cpu, add) {
    const a = cpu.regs.a;
    const target = storedTo(ins, cpu);
    const value = target ? valueOf(cpu) : null;
    if (target === "mover" && a !== null) {
      // the facing-left copy is the same speed negated
      if (ins.operand === VX && ((a << 16) >> 16) >= 0) add({ what: "sets vx", vx: a / 256 });
      if (ins.operand === SPAWN_COUNTER) add({ what: "sets the spawn counter", counter: a & 0xff });
      if (ins.operand === FRAMES) add({ what: "jumps to frame", to: a & 0xff });
    }
    const shake = ins.mnemonic === "STA" && ins.mode === "d" && ins.operand === SHAKE && a !== null ? shakeOf(a) : null;
    if (shake) add({ what: "shakes the stage", shake });
    if (ins.operand === FACING && value) add({ what: "sets the facing", facing: value, ...(target === "opponent" && { who: target }) });
  },
};

/** A word stored to `$E3` as the shake it starts — none without bit 15. */
export function shakeOf(word: number): { pattern: number; frames: number } | null {
  return word & 0x8000 ? { pattern: (word >> 8) & 0x0f, frames: word & 0xff } : null;
}
