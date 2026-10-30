import { describe, expect, it } from "vitest";
import type { Instruction } from "./disasm";
import { CHARACTER, FRAMES, fieldInA, track, ways, type Known } from "./flow";

const k: Known = { frame: null };
const onFrames = (compared: number) => ({ field: FRAMES, compared, asked: null });

describe("ways", () => {
  it("pins the frame where a BEQ is taken and a BNE falls through", () => {
    expect(ways("BEQ", k, onFrames(2))).toEqual([{ frame: 2 }, k]);
    expect(ways("BNE", k, onFrames(2))).toEqual([k, { frame: 2 }]);
  });

  it("bounds it where a BCS is taken and a BCC falls through", () => {
    expect(ways("BCS", k, onFrames(0x34))).toEqual([{ frame: null, from: 0x34 }, k]);
    expect(ways("BCC", { frame: null, from: 0x2b }, onFrames(0x34))).toEqual([{ frame: null, from: 0x2b }, { frame: null, from: 0x34 }]);
  });

  it("never runs a way the frame already known rules out", () => {
    expect(ways("BCC", { frame: 1 }, onFrames(0x14))).toEqual([{ frame: 1 }, null]);
    expect(ways("BEQ", { frame: 1 }, onFrames(2))).toEqual([null, { frame: 1 }]);
    expect(ways("BCC", { frame: null, from: 0x34 }, onFrames(0x14))).toEqual([null, { frame: null, from: 0x34 }]);
  });

  it("names each way after the answer a routine gave in the carry", () => {
    const asked = { set: "once it has landed", clear: "until it lands" };
    expect(ways("BCC", k, { field: null, compared: null, asked })).toEqual([
      { frame: null, when: "until it lands" },
      { frame: null, when: "once it has landed" },
    ]);
  });

  it("follows only the way a known character goes", () => {
    const buu = { field: CHARACTER, compared: 9, asked: null };
    expect(ways("BEQ", k, { ...buu, character: 9 })).toEqual([k, null]);
    expect(ways("BEQ", k, { ...buu, character: 0 })).toEqual([null, k]);
    expect(ways("BEQ", k, buu)).toEqual([k, k]);
  });
});

const ins = (mnemonic: string, mode: Instruction["mode"], operand = 0): Instruction =>
  ({ address: 0, bytes: [], mnemonic, mode, operand, after: { m8: true, x8: false } });

describe("what A and Y hold", () => {
  it("keeps a byte field through AND #$FF, and forgets it on any other write", () => {
    expect(fieldInA(ins("AND", "im", 0x00ff), CHARACTER)).toBe(CHARACTER);
    expect(fieldInA(ins("AND", "im", 0x0f), CHARACTER)).toBeNull();
    expect(fieldInA(ins("LDA", "dx", FRAMES), null)).toBe(FRAMES);
    expect(fieldInA(ins("ORA", "dx", FRAMES + 1), FRAMES)).toBe(FRAMES);
    expect(fieldInA(ins("ORA", "dx", 0x60), FRAMES)).toBeNull();
  });

  it("reads Y's constant from an index-width immediate", () => {
    const regs = { a: null, y: null };
    track(ins("LDY", "ix", 0x130a), regs);
    expect(regs.y).toBe(0x130a);
    track(ins("INY", "imp"), regs);
    expect(regs.y).toBeNull();
  });
});
