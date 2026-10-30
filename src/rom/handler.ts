import { toFile } from "./cartridge";
import { decode, ends, target, type Widths } from "./disasm";
import { FRAMES, fieldInA, isBranch, next, track, ways, type Known } from "./flow";
import { ROUTINES, type Registers } from "./routines";

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
  /** What a routine answered on the way here (`routines.ts`): "once it has landed". */
  when?: string;
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
}

/** Banks holding move handlers and their helpers, not the engine. */
const OWN_BANKS = new Set([0x0f, 0x10, 0x20]);

/** Field 0x6e: a `b0` fires only while it equals the command's counter (`script.ts`). */
const SPAWN_COUNTER = 0x6e;
const STEP = 0x46;
const VX = 0x7c;
/** Where a handler that jumps by step puts the entry before `JMP ($0064)`. */
const DISPATCH = 0x64;

/** One way through the handler: where, and what is known on arriving there. */
interface Path extends Known {
  at: number;
  w: Widths;
  step?: number;
  regs: Registers;
  /** The fighter field A holds, and the flags what it was last compared with (0 for the load itself). */
  compared?: number | null;
  field?: number | null;
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
  const seen = new Set<string>();
  // entered from $0F:8000 with an 8-bit accumulator and 16-bit index registers
  const queue: Path[] = [{ at: entry, w: { m8: true, x8: false }, frame: null, regs: { a: null, y: null } }];
  while (queue.length > 0 && seen.size < 4000) {
    const path = queue.shift()!;
    let { at, w } = path;
    const { frame, from, step, when } = path;
    const regs = { ...path.regs };
    let readsStep = false;
    let table: number | null = null;
    // the frame a CMP on field 0x44 left in the flags, until something else sets them
    let compared = path.compared ?? null;
    let field = path.field ?? null;
    let answer: { set: string; clear: string } | null = null;
    for (;;) {
      const key = `${at}:${frame}:${from}:${step}:${when}:${regs.a}:${regs.y}:${compared}:${field}`;
      if (seen.has(key)) break;
      seen.add(key);
      const ins = decode(read, at, w);
      const add = (fact: Omit<HandlerFact, "frame">) =>
        facts.push({ at, fact: { frame, ...(frame === null && from !== undefined && { from }), ...(when && { when }), ...(step !== undefined && { step }), ...fact } });
      const asked = answer;
      answer = null;
      const flags = compared;
      if (!isBranch(ins)) compared = null;

      field = fieldInA(ins, field);
      if (field !== null && (ins.mnemonic === "LDA" || ins.mnemonic === "ORA")) compared = 0;
      if (field !== null && ins.mnemonic === "CMP" && ins.mode === "im") compared = ins.operand;
      if (ins.mnemonic === "LDA" && ins.mode === "dx" && ins.operand === STEP) readsStep = true;
      if (ins.mnemonic === "LDA" && ins.mode === "lx" && readsStep) table = ins.operand;
      if (ins.mnemonic === "STA" && ins.mode === "dx" && regs.a !== null) {
        const v = regs.a;
        // the facing-left copy is the same speed negated
        if (ins.operand === VX && ((v << 16) >> 16) >= 0) add({ what: "sets vx", vx: v / 256 });
        if (ins.operand === SPAWN_COUNTER) add({ what: "sets the spawn counter", counter: v & 0xff });
        if (ins.operand === FRAMES) add({ what: "jumps to frame", to: v & 0xff });
      }
      const routine = ins.mnemonic === "JSL" ? ROUTINES[ins.operand] : undefined;
      if (routine) {
        const fact = routine.fact(regs);
        if (fact) add(fact);
        answer = routine.carry?.(regs) ?? null;
      }
      // a jump through the by-step table: each entry is the code for its step
      if (ins.mnemonic === "JMP" && ins.mode === "ai" && ins.operand === DISPATCH && table !== null) {
        for (let s = 0; s < steps; s++) {
          const word = read(table + 2 * s) | (read(table + 2 * s + 1) << 8);
          queue.push({ at: (at & 0xff0000) | word, w: ins.after, frame, step: s, when, regs: { ...regs } });
        }
      }

      const to = target(ins);
      const call = ins.mnemonic === "JSL" || ins.mnemonic === "JSR";
      if (to !== null && !call) {
        const [taken, through] = ways(ins.mnemonic, { frame, from, when }, { field, compared: flags, asked, character });
        if (taken) queue.push({ at: to, w: ins.after, step, regs: { ...regs }, compared, field, ...taken });
        if (!through) break;
        Object.assign(path, through);
      }
      // a handler's own helpers do part of its work (the jump's landing sound);
      // the engine's routines are what ROUTINES names, not followed
      if (to !== null && call && !routine && OWN_BANKS.has(to >> 16)) {
        queue.push({ at: to, w: ins.after, frame, from, step, when, regs: { ...regs } });
      }
      if (ends(ins)) break;
      if (to !== null && !call && (path.frame !== frame || path.from !== from || path.when !== when)) {
        // falling through learnt something: carry on as a new path
        queue.push({ at: next(ins), w: ins.after, frame: path.frame, from: path.from, step, when: path.when, regs, compared, field });
        break;
      }
      if (call) {
        regs.a = regs.y = null;
        field = null;
      }
      else track(ins, regs);
      w = ins.after;
      at = next(ins);
    }
  }
  // by frame, then step, then in the order the code has them
  const order = (f: HandlerFact) => [f.frame ?? -1, f.step ?? -1];
  facts.sort((a, b) => order(a.fact)[0] - order(b.fact)[0] || order(a.fact)[1] - order(b.fact)[1] || a.at - b.at);
  return dedupe(facts.map((f) => f.fact));
}

/**
 * Code two paths share is read once per path: the same fact again is dropped,
 * and so is one under a later bound, or under an answer, than a copy of it
 * that turns up without — or on any frame, where the copy is on one.
 */
function dedupe(facts: HandlerFact[]): HandlerFact[] {
  const bare = (f: HandlerFact) => JSON.stringify({ ...f, frame: undefined, from: undefined, when: undefined });
  const weaker = (g: HandlerFact, f: HandlerFact) =>
    (g.when === undefined || g.when === f.when) &&
    (g.frame !== null ? g.frame === f.frame : (g.from ?? 0) <= (f.frame ?? f.from ?? 0));
  const kept: HandlerFact[] = [];
  for (const f of facts) {
    if (facts.some((g) => g !== f && bare(g) === bare(f) && weaker(g, f) && !(weaker(f, g) && facts.indexOf(g) > facts.indexOf(f)))) continue;
    kept.push(f);
  }
  return kept;
}
