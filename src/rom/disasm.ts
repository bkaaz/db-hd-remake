/**
 * A 65816 disassembler, enough to read the game's code from a terminal.
 *
 * The one thing that makes 65816 hard to read statically is that an immediate
 * operand is one byte or two depending on the M and X flags at that moment.
 * This follows REP/SEP within the straight line it decodes; where a routine is
 * entered with other widths, the caller says so — a wrong guess shows up as
 * nonsense a few lines on, never as an error.
 */

import { OPCODES, operandSize, type Mode } from "./opcodes";

export interface Widths {
  /** Accumulator is 8-bit (M set). */
  m8: boolean;
  /** Index registers are 8-bit (X set). */
  x8: boolean;
}

export interface Instruction {
  /** 24-bit CPU address. */
  address: number;
  bytes: number[];
  mnemonic: string;
  mode: Mode;
  operand: number;
  /** Widths in force after this instruction. */
  after: Widths;
}

export function decode(read: (address: number) => number, address: number, w: Widths): Instruction {
  const bank = address & 0xff0000;
  const at = (i: number) => read(bank | ((address + i) & 0xffff));
  const op = at(0);
  const { mnemonic, mode } = OPCODES[op];
  const size = operandSize(mode, w.m8, w.x8);
  const bytes = [op];
  let operand = 0;
  for (let i = 0; i < size; i++) {
    bytes.push(at(1 + i));
    operand |= at(1 + i) << (8 * i);
  }
  let after = w;
  if (mnemonic === "REP") after = { m8: w.m8 && !(operand & 0x20), x8: w.x8 && !(operand & 0x10) };
  if (mnemonic === "SEP") after = { m8: w.m8 || !!(operand & 0x20), x8: w.x8 || !!(operand & 0x10) };
  return { address, bytes, mnemonic, mode, operand, after };
}

/** Where a branch or a same-bank jump lands, or null if it is not one. */
export function target(ins: Instruction): number | null {
  const bank = ins.address & 0xff0000;
  const next = ins.address + ins.bytes.length;
  if (ins.mode === "r") return bank | ((next + ((ins.operand << 24) >> 24)) & 0xffff);
  if (ins.mode === "rl") return bank | ((next + ((ins.operand << 16) >> 16)) & 0xffff);
  if (ins.mode === "a" && (ins.mnemonic === "JSR" || ins.mnemonic === "JMP")) return bank | ins.operand;
  if (ins.mode === "l" && (ins.mnemonic === "JSL" || ins.mnemonic === "JML")) return ins.operand;
  return null;
}

/** Control does not fall through to the next instruction. */
export function ends(ins: Instruction): boolean {
  return ["RTS", "RTL", "RTI", "JMP", "JML", "BRA", "BRL", "STP"].includes(ins.mnemonic);
}

export function operandText(ins: Instruction): string {
  const n = ins.bytes.length - 1;
  const h = (v: number, digits: number) => "$" + v.toString(16).padStart(digits, "0");
  const v = h(ins.operand, 2 * n);
  const t = target(ins);
  switch (ins.mode) {
    case "imp": return "";
    case "acc": return "A";
    case "im": case "ix": case "i8": return "#" + v;
    case "d": case "a": case "l": return t !== null ? long(t) : v;
    case "dx": case "ax": case "lx": return v + ",X";
    case "dy": case "ay": return v + ",Y";
    case "di": case "ai": return `(${v})`;
    case "dix": case "aix": return `(${v},X)`;
    case "diy": return `(${v}),Y`;
    case "dil": case "ail": return `[${v}]`;
    case "dily": return `[${v}],Y`;
    case "s": return v + ",S";
    case "siy": return `(${v},S),Y`;
    case "r": case "rl": return long(t!);
    case "bm": return `${h(ins.operand >> 8, 2)},${h(ins.operand & 0xff, 2)}`;
  }
}

export function long(address: number): string {
  const bank = (address >> 16).toString(16).padStart(2, "0");
  return `$${bank}:${(address & 0xffff).toString(16).padStart(4, "0")}`;
}
