import { toFile } from "./cartridge";
import { called, START, step as stepCpu, writesA, type Cpu } from "./cpu";
import { decode, ends, target as jumpTarget, type Instruction, type Widths } from "./disasm";
import { tidy } from "./facts";
import { next, ways, type Asked, type Known } from "./flow";
import type { HandlerFact } from "./handler";
import type { Routine } from "./routines";

/**
 * Code read without running it, by following every branch with what it
 * tells (`flow.ts`): the frame a comparison on the body's counter pins or
 * bounds, what a routine answered in the carry, the constants loaded
 * before a call, and — through a `JMP ($0064)` table indexed by one field —
 * the entries the body says to follow. A move's handler (`handler.ts`) and
 * an object's code (`objectCode.ts`) are the same kind of code over
 * different fields; a `Body` says which. A test it cannot read leaves both
 * ways open, so code written another way reads as facts under fewer
 * conditions, never as wrong ones.
 */

/** What kind of code is walked: its fields, its routines, what it writes down. */
export interface Body {
  /** The field its frame tests read: a fighter's 0x44, an object's timer. */
  frames: number;
  /** A `JMP ($0064)` table indexed by `field`: the entries to follow, each its own `step` when `tagged`. */
  dispatch: { field: number; entries: number[]; tagged: boolean };
  /** Its fields by name, for tests said in words. */
  names: Record<number, string>;
  routines: Record<number, Routine>;
  /** Banks of its own helpers, followed into. */
  ownBanks: Set<number>;
  /** Where a jump goes back to the code that called it: the end of the path. */
  stops: Set<number>;
  /** What one instruction does that is a fact — a store to a field it knows. */
  observe(ins: Instruction, cpu: Cpu, add: (fact: Omit<HandlerFact, "frame">) => void): void;
}

/** Where a table's entry is put before `JMP ($0064)`. */
const DISPATCH = 0x64;

/** One way through the code: where, and what is known on arriving there. */
interface Path extends Known {
  at: number;
  w: Widths;
  step?: number;
  cpu: Cpu;
  /** Inside a routine it called: the call, which is where its facts sort. */
  site?: number;
}

export function walk(rom: Uint8Array, entry: number, body: Body, character?: number): HandlerFact[] {
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
    let readsDispatch = false;
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
      if (ins.mnemonic === "LDA" && ins.mode === "dx" && ins.operand === body.dispatch.field) readsDispatch = true;
      if (ins.mnemonic === "LDA" && ins.mode === "lx" && readsDispatch) table = ins.operand;
      body.observe(ins, cpu, add);
      const routine = ins.mnemonic === "JSL" ? body.routines[ins.operand] : undefined;
      if (routine) {
        const fact = routine.fact(cpu);
        if (fact) add({ ...fact, ...(cpu.x === "opponent" && { who: cpu.x }) });
        asked = routine.carry?.(cpu) ?? null;
      }
      // a jump through a table by the dispatch field: the entries the body follows
      if (ins.mnemonic === "JMP" && ins.mode === "ai" && ins.operand === DISPATCH && table !== null) {
        for (const s of body.dispatch.entries) {
          const word = read(table + 2 * s) | (read(table + 2 * s + 1) << 8);
          queue.push({ at: (at & 0xff0000) | word, w: ins.after, ...k, ...(body.dispatch.tagged && { step: s }), cpu });
        }
      }

      const to = jumpTarget(ins);
      const call = ins.mnemonic === "JSL" || ins.mnemonic === "JSR";
      if (to !== null && !call) {
        const [taken, through] = ways(ins.mnemonic, k, cpu, answer, character, body.frames, body.names);
        const [yes, no] = [taken?.when?.at(-1), through?.when?.at(-1)];
        if (yes && no && yes !== no) opposite.set(yes, no).set(no, yes);
        // a way back into the code that called it is not this code's
        if (taken && !body.stops.has(to)) queue.push({ at: to, w: ins.after, step, site, cpu, ...taken });
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
      if (to !== null && call && (routine ? routine.follow : body.ownBanks.has(to >> 16))) {
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

