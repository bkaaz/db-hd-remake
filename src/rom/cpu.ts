import type { Instruction } from "./disasm";

/**
 * What one path through a handler can tell of the processor: the constants
 * in A and Y, where A's value was loaded from and whose it is, which
 * fighter X and Y point at, what the handler left in the scratch bytes a
 * routine reads its arguments from, and what the flags tested last — enough
 * for `flow.ts` to say what a branch asks and `routines.ts` what a call
 * does. Anything it cannot follow it forgets, so nothing it did not see is
 * ever named.
 */

/** A fighter, as the handler sees it: its own (X on entry) or the other ($0D:D7DB). */
export type Who = "mover" | "opponent";

/** Where A's value was loaded from: a fighter field (`$nn,X`, `$00nn,Y`) or one of the game's own (`$nn`). */
export type Source = { field: number; who: Who | null } | { global: number };

/** A value known well enough to say: a constant, or a field turned by `EOR`. */
export type Value = { n: number } | { field: number; who: Who | null; eor?: number };

/** What the flags hold, about A. */
export type Test =
  /** Z: A is 0 — a load, or `ORA` with the field's next byte. */
  | { op: "zero" }
  /** `CMP #value`. */
  | { op: "cmp"; value: number }
  /** `BIT #mask`: Z when none of its bits are set. */
  | { op: "bit"; mask: number }
  /** `CMP $field,X`. */
  | { op: "field"; field: number }
  /** `CPY #value`: about Y, not A — the frame when Y was loaded from it (`$20:8A2D`). */
  | { op: "cmpY"; value: number };

export interface Registers {
  a: number | null;
  y: number | null;
  /** Y as a fighter field plus a count of `INY` — a palette field and the one 8 after it. */
  yFrom?: { field: number; plus: number };
}

export interface Cpu {
  regs: Registers;
  source: Source | null;
  /** `AND #mask` applied to the source since it was loaded. */
  mask?: number;
  /** `EOR #bits` applied to it — a facing turned. */
  eor?: number;
  /** `ORA #bits` applied to it — a flag set. */
  ora?: number;
  test: Test | null;
  /** Whose block X points at, and Y when it points at one. */
  x: Who | null;
  yWho?: Who;
  /** X as `PHX` left it, for `PLX`. */
  pushed: (Who | null)[];
  /** The direct-page bytes `$00`–`$0F` a routine takes its arguments in, by address. */
  scratch: Record<number, Value>;
}

export const START: Cpu = { regs: { a: null, y: null }, source: null, test: null, x: "mover", pushed: [], scratch: {} };

const WRITES_A = new Set(["LDA", "ADC", "SBC", "AND", "ORA", "EOR", "PLA", "TXA", "TYA", "XBA", "TDC", "TSC"]);
const SHIFTS = new Set(["ASL", "LSR", "ROL", "ROR", "INC", "DEC"]);
const WRITES_Y = new Set(["LDY", "INY", "DEY", "PLY", "TAY", "TXY"]);
const WRITES_X = new Set(["LDX", "INX", "DEX", "TAX", "TSX"]);
/** Leave the flags as they were. */
const QUIET = new Set(["STA", "STX", "STY", "STZ", "PHA", "PHB", "PHD", "PHK", "PHP", "PHX", "PHY", "REP", "SEP", "NOP", "TXS", "TCS", "XCE", "WDM",
  "BEQ", "BNE", "BCC", "BCS", "BMI", "BPL", "BVC", "BVS", "BRA", "BRL", "JMP", "JML"]);
/** The highest scratch byte a routine's arguments are read from. */
const SCRATCH = 0x0f;

export function writesA(ins: Instruction): boolean {
  return WRITES_A.has(ins.mnemonic) || (SHIFTS.has(ins.mnemonic) && ins.mode === "acc");
}

/** The processor after an instruction that is not a call. */
export function step(ins: Instruction, cpu: Cpu): Cpu {
  const { mnemonic, mode, operand } = ins;
  const next: Cpu = { ...cpu, regs: { ...cpu.regs }, test: QUIET.has(mnemonic) ? cpu.test : null };
  if (WRITES_Y.has(mnemonic)) {
    next.regs.y = mnemonic === "LDY" && mode === "ix" ? operand : null;
    const from = cpu.source && "field" in cpu.source && cpu.mask === undefined ? cpu.source.field : null;
    next.regs.yFrom =
      mnemonic === "LDY" && mode === "dx" ? { field: operand, plus: 0 }
      : mnemonic === "TAY" && from !== null ? { field: from, plus: 0 }
      : mnemonic === "INY" && cpu.regs.yFrom ? { ...cpu.regs.yFrom, plus: cpu.regs.yFrom.plus + 1 }
      : undefined;
    next.yWho = mnemonic === "TXY" ? (cpu.x ?? undefined) : undefined;
  }
  if (WRITES_X.has(mnemonic)) next.x = null;
  if (mnemonic === "TYX") next.x = cpu.yWho ?? null;
  if (mnemonic === "PHX") next.pushed = [...cpu.pushed, cpu.x];
  if (mnemonic === "PLX") [next.x, next.pushed] = [cpu.pushed.at(-1) ?? null, cpu.pushed.slice(0, -1)];
  if (mnemonic === "STA" && mode === "d" && operand <= SCRATCH) {
    const value = valueOf(cpu);
    next.scratch = { ...cpu.scratch };
    if (value) next.scratch[operand] = value;
    else delete next.scratch[operand];
  }

  if (mnemonic === "CMP" && mode === "im") return { ...next, test: { op: "cmp", value: operand } };
  if (mnemonic === "CPY" && mode === "ix") return { ...next, test: { op: "cmpY", value: operand } };
  if (mnemonic === "CMP" && mode === "dx") return { ...next, test: { op: "field", field: operand } };
  if (mnemonic === "BIT" && mode === "im") return { ...next, test: { op: "bit", mask: operand } };
  const field = mode === "dx" ? cpu.x : mode === "ay" ? (cpu.yWho ?? undefined) : undefined;
  if (mnemonic === "LDA" && (field !== undefined || mode === "d" || mode === "a")) {
    const source: Source = mode === "d" || mode === "a" ? { global: operand } : { field: operand, who: field ?? null };
    return { ...next, regs: { ...next.regs, a: null }, source, mask: undefined, eor: undefined, ora: undefined, test: { op: "zero" } };
  }
  if (cpu.source && mnemonic === "AND" && mode === "im")
    // AND #$FF leaves a byte field as it was
    return { ...next, mask: operand === 0xff || operand === 0x00ff ? cpu.mask : (cpu.mask ?? 0xffff) & operand, test: { op: "zero" } };
  if (cpu.source && mnemonic === "EOR" && mode === "im") return { ...next, eor: (cpu.eor ?? 0) ^ operand, test: null };
  if (cpu.source && mnemonic === "ORA" && mode === "im") return { ...next, ora: (cpu.ora ?? 0) | operand, test: null };
  if (cpu.source && "field" in cpu.source && mnemonic === "ORA" && mode === "dx" && operand === cpu.source.field + 1)
    // LDA $44,X : ORA $45,X asks whether the whole word is 0
    return { ...next, test: { op: "zero" } };
  if (writesA(ins)) {
    // TYA carries Y's constant over: a move set from a choice of LDY #s ($20:9AE8)
    next.regs.a = mnemonic === "LDA" && mode === "im" ? operand : mnemonic === "TYA" ? cpu.regs.y : null;
    return { ...next, source: null, mask: undefined, eor: undefined, ora: undefined, test: mnemonic === "LDA" ? { op: "zero" } : null };
  }
  return next;
}

/** What A holds, as far as it can be said. */
export function valueOf(cpu: Cpu): Value | null {
  if (cpu.regs.a !== null) return { n: cpu.regs.a };
  if (cpu.source && "field" in cpu.source && cpu.mask === undefined)
    return { field: cpu.source.field, who: cpu.source.who, ...(cpu.eor !== undefined && { eor: cpu.eor }) };
  return null;
}

/**
 * After a call: nothing of A, Y or the flags is known, nor the scratch bytes
 * unless the routine leaves them (`keeps`); X is kept, as every routine
 * here does. `yWho`: the fighter a routine leaves Y pointing at.
 */
export function called(cpu: Cpu, yWho?: Who, keeps = false): Cpu {
  return { ...cpu, regs: { a: null, y: null }, source: null, mask: undefined, eor: undefined, test: null, yWho, scratch: keeps ? cpu.scratch : {} };
}

/** The mover's field A holds, or null. */
export function fieldOf(cpu: Cpu): number | null {
  const s = cpu.source;
  return s && "field" in s && s.who === "mover" && cpu.mask === undefined && cpu.eor === undefined ? s.field : null;
}

/** Whose field a store to `$nn,X` or `$00nn,Y` writes, or null if neither is known. */
export function storedTo(ins: Instruction, cpu: Cpu): Who | null {
  if (ins.mnemonic !== "STA") return null;
  if (ins.mode === "dx") return cpu.x;
  if (ins.mode === "ay") return cpu.yWho ?? null;
  return null;
}
