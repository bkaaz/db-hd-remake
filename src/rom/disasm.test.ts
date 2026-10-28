import { describe, expect, it } from "vitest";
import { decode, ends, operandText, target, type Widths } from "./disasm";
import { OPCODES } from "./opcodes";

/** Bytes laid out from $0F:8000, everything else zero. */
function bus(...bytes: number[]) {
  return (address: number) => (address >= 0x0f8000 ? (bytes[address - 0x0f8000] ?? 0) : 0);
}

const W8: Widths = { m8: true, x8: true };
const W16: Widths = { m8: false, x8: false };

describe("the opcode table", () => {
  // one per row, so a cell shifted anywhere in a row is caught
  it.each([
    [0x0f, "ORA", "l"], [0x1f, "ORA", "lx"], [0x22, "JSL", "l"], [0x3c, "BIT", "ax"],
    [0x44, "MVP", "bm"], [0x5c, "JML", "l"], [0x62, "PER", "rl"], [0x7c, "JMP", "aix"],
    [0x82, "BRL", "rl"], [0x96, "STX", "dy"], [0xa2, "LDX", "ix"], [0xbe, "LDX", "ay"],
    [0xc2, "REP", "i8"], [0xdc, "JML", "ail"], [0xeb, "XBA", "imp"], [0xfc, "JSR", "aix"],
  ])("0x%s is %s %s", (op, mnemonic, mode) => {
    expect(OPCODES[op]).toEqual({ mnemonic, mode });
  });

  it("has all 256", () => expect(OPCODES).toHaveLength(256));
});

describe("decode", () => {
  it("sizes an immediate by the flag that governs it", () => {
    const read = bus(0xa9, 0x34, 0x12, 0xa2, 0x00, 0x31);
    expect(decode(read, 0x0f8000, W8).bytes).toEqual([0xa9, 0x34]);
    expect(decode(read, 0x0f8000, W16).bytes).toEqual([0xa9, 0x34, 0x12]);
    expect(decode(read, 0x0f8003, { m8: true, x8: false }).operand).toBe(0x3100);
  });

  it("follows REP and SEP", () => {
    const read = bus(0xc2, 0x30, 0xe2, 0x20);
    const rep = decode(read, 0x0f8000, W8);
    expect(rep.after).toEqual(W16);
    expect(decode(read, 0x0f8002, rep.after).after).toEqual({ m8: true, x8: false });
  });

  it("resolves a backward branch within the bank", () => {
    const ins = decode(bus(0xd0, 0xfe), 0x0f8000, W8); // BNE to itself
    expect(target(ins)).toBe(0x0f8000);
    expect(operandText(ins)).toBe("$0f:8000");
  });

  it("prints a block move as source, destination", () => {
    const ins = decode(bus(0x54, 0x7e, 0x7f), 0x0f8000, W8); // MVN: dst byte first
    expect(operandText(ins)).toBe("$7f,$7e");
  });

  it("knows where control stops falling through", () => {
    expect(ends(decode(bus(0x6b), 0x0f8000, W8))).toBe(true); // RTL
    expect(ends(decode(bus(0xf0, 0x02), 0x0f8000, W8))).toBe(false); // BEQ
  });
});
