import { fieldOf, type Cpu } from "./cpu";
import type { Instruction } from "./disasm";
import { sayTest } from "./tests";

/**
 * Which way a branch goes, and what each way learns: the frame a comparison
 * pins or bounds, the character's own way through code the roster shares,
 * what A can still be, a routine's answer, or a test named in words
 * (`tests.ts`). A way the known values rule out is never run. Kept apart
 * from `handler.ts`, which walks the paths and writes down what they do.
 */

export const CHARACTER = 0x00;
export const FRAMES = 0x44;
/** Field 0x46, the script's step — pinned by a `CMP #n` as the frame is (Saiyan Meteor's `$20:8992`). */
export const STEP = 0x46;

/** What a path knows of the frame and the state of play. */
export interface Known {
  /** The frame of the move, when a comparison pinned it. */
  frame: number | null;
  /** The first frame it can be, when only a `BCC`/`BCS` bounds it. */
  from?: number;
  /** What the code waits on, in words, oldest first. */
  when?: string[];
  /** What A can hold, when a constant or a comparison narrowed it. */
  range?: [number, number];
  /** The script's step, when a comparison pinned it. */
  step?: number;
}

/** A routine just called answers in the carry: what each answer means. */
export type Asked = { set: string; clear: string } | null;

/** The two ways out of a conditional branch, taken and through; null for one never run. */
/**
 * `frames`: the field a comparison pins the frame by (a fighter's 0x44, an
 * object's timer); `names`: what to call the fields a test is said by.
 */
export function ways(
  mnemonic: string,
  k: Known,
  cpu: Cpu,
  asked: Asked,
  character?: number,
  frames = FRAMES,
  names?: Record<number, string>,
): [Known | null, Known | null] {
  if (asked && mnemonic === "BCS") return split(k, asked.set, asked.clear);
  if (asked && mnemonic === "BCC") return split(k, asked.clear, asked.set);
  const { test, source } = cpu;
  if (test?.op === "cmpY") {
    const y = cpu.regs.yFrom;
    return y && y.plus === 0 && y.field === frames ? onFrame(mnemonic, test.value, k) : [k, k];
  }
  if (!test || test.op === "field" || test.op === "bit") {
    const said = source && test ? sayTest(mnemonic, source, cpu.mask, test, names) : null;
    return said ? split(k, ...said) : [k, k];
  }
  const value = test.op === "cmp" ? test.value : 0;
  const field = fieldOf(cpu);
  if (field === frames) return onFrame(mnemonic, value, k);
  if (field === STEP && frames === FRAMES && test.op === "cmp") return onStep(mnemonic, value, k);
  if (field === CHARACTER && character !== undefined) return onValue(mnemonic, character, value, k);
  if (!source && test.op === "cmp") return onRange(mnemonic, value, k);
  const said = source ? sayTest(mnemonic, source, cpu.mask, test, names) : null;
  return said ? split(k, ...said) : [k, k];
}

/** Each way waits on its answer too — unless the path already has one, which settles the branch. */
function split(k: Known, taken: string, through: string): [Known | null, Known | null] {
  if (k.when?.includes(taken)) return [k, null];
  if (k.when?.includes(through)) return [null, k];
  return [{ ...k, when: [...(k.when ?? []), taken] }, { ...k, when: [...(k.when ?? []), through] }];
}

/**
 * A compared with a constant: each way narrows what A can be, and a way no
 * value of A takes is never run (`$0D:EC12`'s shake of pattern 0, behind a
 * speed it has already capped).
 */
function onRange(mnemonic: string, c: number, k: Known): [Known | null, Known | null] {
  const [lo, hi] = k.range ?? [0, 0xffff];
  const within = (l: number, h: number): Known | null => (l > h ? null : { ...k, range: [l, h] });
  const below = within(lo, Math.min(hi, c - 1));
  const atLeast = within(Math.max(lo, c), hi);
  const equal = within(Math.max(lo, c), Math.min(hi, c));
  if (mnemonic === "BCC") return [below, atLeast];
  if (mnemonic === "BCS") return [atLeast, below];
  if (mnemonic === "BEQ") return [equal, lo === hi && lo === c ? null : k];
  if (mnemonic === "BNE") return [lo === hi && lo === c ? null : k, equal];
  return [k, k];
}

/** The frame compared (`BEQ` taken, `BNE` through), or a bound on it (`BCS` taken, `BCC` through). */
function onFrame(mnemonic: string, compared: number, k: Known): [Known | null, Known | null] {
  const equal = k.frame === null ? null : k.frame === compared;
  const atLeast = k.frame !== null ? k.frame >= compared : (k.from ?? 0) >= compared ? true : null;
  const exactly = { ...k, frame: compared };
  const bounded = { ...k, from: Math.max(k.from ?? 0, compared) };
  if (mnemonic === "BEQ") return [equal === false ? null : exactly, equal === true ? null : k];
  if (mnemonic === "BNE") return [equal === true ? null : k, equal === false ? null : exactly];
  if (mnemonic === "BCS") return [atLeast === false ? null : bounded, atLeast === true ? null : k];
  if (mnemonic === "BCC") return [atLeast === true ? null : k, atLeast === false ? null : bounded];
  return [k, k];
}

/** The step compared: pinned on the way `BEQ` takes or `BNE` falls through; a step already pinned settles it. */
function onStep(mnemonic: string, compared: number, k: Known): [Known | null, Known | null] {
  const equal = k.step === undefined ? null : k.step === compared;
  const exactly = { ...k, step: compared };
  if (mnemonic === "BEQ") return [equal === false ? null : exactly, equal === true ? null : k];
  if (mnemonic === "BNE") return [equal === true ? null : k, equal === false ? null : exactly];
  return [k, k];
}

/** A field whose value is known: only the way it goes. */
function onValue(mnemonic: string, value: number, compared: number, k: Known): [Known | null, Known | null] {
  const taken: Record<string, boolean> = { BEQ: value === compared, BNE: value !== compared, BCS: value >= compared, BCC: value < compared };
  if (!(mnemonic in taken)) return [k, k];
  return taken[mnemonic] ? [k, null] : [null, k];
}

export function next(ins: Instruction): number {
  return (ins.address & 0xff0000) | ((ins.address + ins.bytes.length) & 0xffff);
}
