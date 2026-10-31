import { toFile } from "./cartridge";
import { decode, ends, target as jumpTarget, type Widths } from "./disasm";
import { called, START, step as stepCpu, storedTo, valueOf, writesA, type Cpu, type Value, type Who } from "./cpu";
import { FRAMES, next, ways, type Asked, type Known } from "./flow";
import { tidy } from "./facts";
import { ROUTINES } from "./routines";

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
  /** `$0F:B321`'s throw: what it costs the opponent and how it leaves. */
  launch?: { damage: number; stun: number; move: number; vx: number; vy: number; facing: Value };
}

/** Banks holding move handlers and their helpers, not the engine. */
const OWN_BANKS = new Set([0x0f, 0x10, 0x20]);

/** Field 0x6e: a `b0` fires only while it equals the command's counter (`script.ts`). */
const SPAWN_COUNTER = 0x6e;
const STEP = 0x46;
const VX = 0x7c;
const FACING = 0x12;
/** `$E3`, the stage's shake (`$0D:C558`): bit 15 on, bits 8–11 the pattern, the low byte frames. */
const SHAKE = 0xe3;
/** Where a handler that jumps by step puts the entry before `JMP ($0064)`. */
const DISPATCH = 0x64;

/** One way through the handler: where, and what is known on arriving there. */
interface Path extends Known {
  at: number;
  w: Widths;
  step?: number;
  cpu: Cpu;
  /** Inside a routine it called: the call, which is where its facts sort. */
  site?: number;
}

/**
 * `steps`: how many steps the move's script has — the length of a by-step
 * table. `character`: whose handler it is, for code shared by the roster
 * that asks (charging's sound, `$0F:A020`).
 */
export function handlerFacts(rom: Uint8Array, entry: number, steps = 0, character?: number): HandlerFact[] {
  const read = (address: number) => {
    const at = toFile(address);
    if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
    return rom[at];
  };
  const facts: { fact: HandlerFact; at: number }[] = [];
  // the two answers of each test met, to merge a fact found under both
  const opposite = new Map<string, string>();
  const seen = new Set<string>();
  // entered from $0F:8000 with an 8-bit accumulator and 16-bit index registers
  const queue: Path[] = [{ at: entry, w: { m8: true, x8: false }, frame: null, cpu: START }];
  while (queue.length > 0 && seen.size < 4000) {
    const path = queue.shift()!;
    let { at, w, cpu } = path;
    const { step, site } = path;
    let k: Known = { frame: path.frame, from: path.from, when: path.when, range: path.range };
    let readsStep = false;
    let table: number | null = null;
    let asked: Asked = null;
    for (;;) {
      const key = JSON.stringify([at, k, step, cpu]);
      if (seen.has(key)) break;
      seen.add(key);
      const ins = decode(read, at, w);
      const known = k;
      const add = (fact: Omit<HandlerFact, "frame">) =>
        facts.push({ at: site ?? at, fact: {
          frame: known.frame,
          ...(known.frame === null && known.from !== undefined && { from: known.from }),
          ...(known.when && { when: known.when }),
          ...(step !== undefined && { step }),
          ...fact,
        } });
      const answer = asked;
      asked = null;
      const a = cpu.regs.a;
      const target = storedTo(ins, cpu);
      const value = target ? valueOf(cpu) : null;

      if (ins.mnemonic === "LDA" && ins.mode === "dx" && ins.operand === STEP) readsStep = true;
      if (ins.mnemonic === "LDA" && ins.mode === "lx" && readsStep) table = ins.operand;
      if (target === "mover" && a !== null) {
        // the facing-left copy is the same speed negated
        if (ins.operand === VX && ((a << 16) >> 16) >= 0) add({ what: "sets vx", vx: a / 256 });
        if (ins.operand === SPAWN_COUNTER) add({ what: "sets the spawn counter", counter: a & 0xff });
        if (ins.operand === FRAMES) add({ what: "jumps to frame", to: a & 0xff });
      }
      const shake = ins.mnemonic === "STA" && ins.mode === "d" && ins.operand === SHAKE && a !== null ? shakeOf(a) : null;
      if (shake) add({ what: "shakes the stage", shake });
      if (ins.operand === FACING && value) add({ what: "sets the facing", facing: value, ...(target === "opponent" && { who: target }) });
      const routine = ins.mnemonic === "JSL" ? ROUTINES[ins.operand] : undefined;
      if (routine) {
        const fact = routine.fact(cpu);
        if (fact) add({ ...fact, ...(cpu.x === "opponent" && { who: cpu.x }) });
        asked = routine.carry?.(cpu) ?? null;
      }
      // a jump through the by-step table: each entry is the code for its step
      if (ins.mnemonic === "JMP" && ins.mode === "ai" && ins.operand === DISPATCH && table !== null) {
        for (let s = 0; s < steps; s++) {
          const word = read(table + 2 * s) | (read(table + 2 * s + 1) << 8);
          queue.push({ at: (at & 0xff0000) | word, w: ins.after, ...k, step: s, cpu });
        }
      }

      const to = jumpTarget(ins);
      const call = ins.mnemonic === "JSL" || ins.mnemonic === "JSR";
      if (to !== null && !call) {
        const [taken, through] = ways(ins.mnemonic, k, cpu, answer, character);
        const [yes, no] = [taken?.when?.at(-1), through?.when?.at(-1)];
        if (yes && no && yes !== no) opposite.set(yes, no).set(no, yes);
        if (taken) queue.push({ at: to, w: ins.after, step, site, cpu, ...taken });
        if (!through) break;
        if (JSON.stringify(through) !== JSON.stringify(k)) {
          // falling through learnt something: carry on as a new path
          queue.push({ at: next(ins), w: ins.after, step, site, cpu, ...through });
          break;
        }
      }
      // a handler's own helpers do part of its work (the jump's landing sound);
      // the engine's routines are what ROUTINES names, followed only for what
      // they do to the whole game (the shake)
      if (to !== null && call && (routine ? routine.follow : OWN_BANKS.has(to >> 16))) {
        queue.push({ at: to, w: ins.after, ...k, step, site: site ?? at, cpu });
      }
      if (ends(ins)) break;
      cpu = call ? called(cpu, routine?.yWho, routine?.keeps) : stepCpu(ins, cpu);
      if (call || writesA(ins)) k = { ...k, range: cpu.regs.a === null ? undefined : [cpu.regs.a, cpu.regs.a] };
      w = ins.after;
      at = next(ins);
    }
  }
  return tidy(facts, opposite);
}

/** A word stored to `$E3` as the shake it starts — none without bit 15. */
export function shakeOf(word: number): { pattern: number; frames: number } | null {
  return word & 0x8000 ? { pattern: (word >> 8) & 0x0f, frames: word & 0xff } : null;
}
