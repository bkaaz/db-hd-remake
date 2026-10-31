import type { Instruction } from "./disasm";
import type { Registers } from "./routines";

/**
 * What one path through a handler can tell of the processor: the constants
 * in A and Y, where A's value was loaded from, and what the flags tested
 * last — enough for `flow.ts` to say what a branch asks. Anything it cannot
 * follow it forgets, so a test it did not see is never named.
 */

/** Where A's value was loaded from: a fighter field (`$nn,X`) or one of the game's own (`$nn`). */
export type Source = { field: number } | { global: number };

/** What the flags hold, about A. */
export type Test =
  /** Z: A is 0 — a load, or `ORA` with the field's next byte. */
  | { op: "zero" }
  /** `CMP #value`. */
  | { op: "cmp"; value: number }
  /** `BIT #mask`: Z when none of its bits are set. */
  | { op: "bit"; mask: number }
  /** `CMP $field,X`. */
  | { op: "field"; field: number };

export interface Cpu {
  regs: Registers;
  source: Source | null;
  /** `AND #mask` applied to the source since it was loaded. */
  mask?: number;
  test: Test | null;
}

export const START: Cpu = { regs: { a: null, y: null }, source: null, test: null };

const WRITES_A = new Set(["LDA", "ADC", "SBC", "AND", "ORA", "EOR", "PLA", "TXA", "TYA", "XBA", "TDC", "TSC"]);
const SHIFTS = new Set(["ASL", "LSR", "ROL", "ROR", "INC", "DEC"]);
const WRITES_Y = new Set(["LDY", "INY", "DEY", "PLY", "TAY", "TXY"]);
/** Leave the flags as they were. */
const QUIET = new Set(["STA", "STX", "STY", "STZ", "PHA", "PHB", "PHD", "PHK", "PHP", "PHX", "PHY", "REP", "SEP", "NOP", "TXS", "TCS", "XCE", "WDM",
  "BEQ", "BNE", "BCC", "BCS", "BMI", "BPL", "BVC", "BVS", "BRA", "BRL", "JMP", "JML"]);

export function writesA(ins: Instruction): boolean {
  return WRITES_A.has(ins.mnemonic) || (SHIFTS.has(ins.mnemonic) && ins.mode === "acc");
}

/** The processor after an instruction that is not a call. */
export function step(ins: Instruction, cpu: Cpu): Cpu {
  const { mnemonic, mode, operand } = ins;
  const regs = { ...cpu.regs };
  if (WRITES_Y.has(mnemonic)) {
    regs.y = mnemonic === "LDY" && mode === "ix" ? operand : null;
    regs.yFrom =
      mnemonic === "LDY" && mode === "dx" ? { field: operand, plus: 0 }
      : mnemonic === "INY" && cpu.regs.yFrom ? { ...cpu.regs.yFrom, plus: cpu.regs.yFrom.plus + 1 }
      : undefined;
  }
  if (mnemonic === "CMP" && mode === "im") return { ...cpu, regs, test: { op: "cmp", value: operand } };
  if (mnemonic === "CMP" && mode === "dx") return { ...cpu, regs, test: { op: "field", field: operand } };
  if (mnemonic === "BIT" && mode === "im") return { ...cpu, regs, test: { op: "bit", mask: operand } };
  if (mnemonic === "LDA" && (mode === "dx" || mode === "d"))
    return { regs: { ...regs, a: null }, source: mode === "dx" ? { field: operand } : { global: operand }, test: { op: "zero" } };
  if (cpu.source && mnemonic === "AND" && mode === "im")
    // AND #$FF leaves a byte field as it was
    return { ...cpu, regs, mask: operand === 0xff || operand === 0x00ff ? cpu.mask : (cpu.mask ?? 0xffff) & operand, test: { op: "zero" } };
  if (cpu.source && "field" in cpu.source && mnemonic === "ORA" && mode === "dx" && operand === cpu.source.field + 1)
    // LDA $44,X : ORA $45,X asks whether the whole word is 0
    return { ...cpu, regs, test: { op: "zero" } };
  if (writesA(ins)) {
    regs.a = mnemonic === "LDA" && mode === "im" ? operand : null;
    return { regs, source: null, test: mnemonic === "LDA" ? { op: "zero" } : null };
  }
  return { ...cpu, regs, test: QUIET.has(mnemonic) ? cpu.test : null };
}

/** After a call: nothing of A, Y or the flags is known. */
export function called(cpu: Cpu): Cpu {
  return { ...cpu, regs: { a: null, y: null }, source: null, mask: undefined, test: null };
}

/** The field A holds, or null. */
export function fieldOf(cpu: Cpu): number | null {
  return cpu.source && "field" in cpu.source && cpu.mask === undefined ? cpu.source.field : null;
}
