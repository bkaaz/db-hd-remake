import type { Instruction } from "./disasm";
import type { Registers } from "./routines";

/**
 * What one path through a handler knows, and how an instruction changes it:
 * the constants in A and Y, the fighter field A holds and what the flags
 * last compared it with, and which way a branch on that goes. Kept apart from
 * `handler.ts`, which walks the paths and writes down what they do.
 */

export const CHARACTER = 0x00;
export const FRAMES = 0x44;

/** What a path knows of the frame, and what a routine answered on the way. */
export interface Known {
  /** The frame of the move, when a comparison pinned it. */
  frame: number | null;
  /** The first frame it can be, when only a `BCC`/`BCS` bounds it. */
  from?: number;
  when?: string;
}

/** What the flags say at a branch. */
export interface Flags {
  /** The fighter field A holds, or null. */
  field: number | null;
  /** What that field was last compared with — 0 for the load itself. */
  compared: number | null;
  /** The routine just called answers in the carry: what each answer means. */
  asked: { set: string; clear: string } | null;
  /** Whose handler it is, for a branch on field 0x00. */
  character?: number;
}

const WRITES_A = new Set(["LDA", "ADC", "SBC", "AND", "ORA", "EOR", "PLA", "TXA", "TYA", "XBA", "TDC", "TSC"]);
const SHIFTS = new Set(["ASL", "LSR", "ROL", "ROR", "INC", "DEC"]);
const WRITES_Y = new Set(["LDY", "INY", "DEY", "PLY", "TAY", "TXY"]);
const BRANCHES = new Set(["BEQ", "BNE", "BCC", "BCS", "BMI", "BPL", "BVC", "BVS", "BRA", "BRL"]);

export function isBranch(ins: Instruction): boolean {
  return BRANCHES.has(ins.mnemonic);
}

/**
 * The fighter field in A after this instruction — `AND #$FF` leaves a byte
 * field as it was, and `ORA` with its next byte (`LDA $44,X : ORA $45,X`)
 * asks whether the whole word is 0, as a load does.
 */
export function fieldInA(ins: Instruction, field: number | null): number | null {
  const keeps =
    (ins.mnemonic === "AND" && ins.mode === "im" && (ins.operand === 0xff || ins.operand === 0x00ff)) ||
    (ins.mnemonic === "ORA" && ins.mode === "dx" && field !== null && ins.operand === field + 1);
  if (!WRITES_A.has(ins.mnemonic) || keeps) return field;
  return ins.mnemonic === "LDA" && ins.mode === "dx" ? ins.operand : null;
}

/**
 * The two ways out of a conditional branch, taken and through, each with
 * what is known along it — null for a way the known values rule out, which
 * is never run.
 */
export function ways(mnemonic: string, k: Known, f: Flags): [Known | null, Known | null] {
  if (f.asked && (mnemonic === "BCC" || mnemonic === "BCS")) {
    const [taken, through] = mnemonic === "BCS" ? [f.asked.set, f.asked.clear] : [f.asked.clear, f.asked.set];
    return [{ ...k, when: taken }, { ...k, when: through }];
  }
  if (f.compared === null) return [k, k];
  if (f.field === FRAMES) return onFrame(mnemonic, f.compared, k);
  if (f.field === CHARACTER && f.character !== undefined) return onValue(mnemonic, f.character, f.compared, k);
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

/** A field whose value is known: only the way it goes. */
function onValue(mnemonic: string, value: number, compared: number, k: Known): [Known | null, Known | null] {
  const taken: Record<string, boolean> = { BEQ: value === compared, BNE: value !== compared, BCS: value >= compared, BCC: value < compared };
  if (!(mnemonic in taken)) return [k, k];
  return taken[mnemonic] ? [k, null] : [null, k];
}

/** What an instruction leaves in A and Y: a constant it loads, or unknown. */
export function track(ins: Instruction, regs: Registers): void {
  if (WRITES_A.has(ins.mnemonic) || (SHIFTS.has(ins.mnemonic) && ins.mode === "acc"))
    regs.a = ins.mnemonic === "LDA" && ins.mode === "im" ? ins.operand : null;
  if (WRITES_Y.has(ins.mnemonic)) regs.y = ins.mnemonic === "LDY" && ins.mode === "ix" ? ins.operand : null;
}

export function next(ins: Instruction): number {
  return (ins.address & 0xff0000) | ((ins.address + ins.bytes.length) & 0xffff);
}
