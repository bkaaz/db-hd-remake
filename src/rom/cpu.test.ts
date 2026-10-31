import { describe, expect, it } from "vitest";
import { called, fieldOf, START, step, type Cpu } from "./cpu";
import type { Instruction } from "./disasm";

const ins = (mnemonic: string, mode: Instruction["mode"], operand = 0): Instruction =>
  ({ address: 0, bytes: [], mnemonic, mode, operand, after: { m8: true, x8: false } });
const run = (...list: Instruction[]): Cpu => run2(START, ...list);
const run2 = (from: Cpu, ...list: Instruction[]): Cpu => list.reduce((cpu, i) => step(i, cpu), from);

describe("step", () => {
  it("keeps a byte field through AND #$FF, and masks it with anything else", () => {
    expect(fieldOf(run(ins("LDA", "dx", 0x00), ins("AND", "im", 0x00ff)))).toBe(0x00);
    expect(run(ins("LDA", "dx", 0xec), ins("AND", "im", 0xc000)).mask).toBe(0xc000);
  });

  it("reads LDA $44,X : ORA $45,X as asking whether the frame is 0", () => {
    const cpu = run(ins("LDA", "dx", 0x44), ins("ORA", "dx", 0x45));
    expect([fieldOf(cpu), cpu.test]).toEqual([0x44, { op: "zero" }]);
    expect(fieldOf(run(ins("LDA", "dx", 0x44), ins("ORA", "dx", 0x60)))).toBeNull();
  });

  it("keeps the flags through a store and a width change, and drops them on anything that sets them", () => {
    const cmp = run(ins("LDA", "dx", 0xec), ins("CMP", "im", 0xc000), ins("SEP", "im", 0x20), ins("STA", "dx", 0x60));
    expect(cmp.test).toEqual({ op: "cmp", value: 0xc000 });
    expect(step(ins("CPX", "ix", 0x3100), cmp).test).toBeNull();
  });

  it("reads Y's constant from an index-width immediate", () => {
    expect(run(ins("LDY", "ix", 0x130a)).regs.y).toBe(0x130a);
    expect(run(ins("LDY", "ix", 0x130a), ins("INY", "imp")).regs.y).toBeNull();
  });

  it("follows Y loaded from a field and counted up: the glow's palette", () => {
    expect(run(ins("LDY", "dx", 0x17), ins("INY", "imp"), ins("INY", "imp")).regs.yFrom).toEqual({ field: 0x17, plus: 2 });
    expect(run(ins("LDY", "dx", 0x17), ins("TAY", "imp")).regs.yFrom).toBeUndefined();
  });

  it("follows whose block X points at: the opponent from $0D:D7DB's Y, the mover back from the stack", () => {
    const held = called(START, "opponent");
    const swapped = run2(held, ins("PHX", "imp"), ins("TYX", "imp"));
    expect(swapped.x).toBe("opponent");
    expect(step(ins("PLX", "imp"), swapped).x).toBe("mover");
  });

  it("keeps what the handler leaves in the scratch bytes, a facing turned included", () => {
    const cpu = run(ins("LDA", "im", 0x28), ins("STA", "d", 0x00), ins("LDA", "dx", 0x12), ins("EOR", "im", 0x40), ins("STA", "d", 0x04));
    expect(cpu.scratch).toEqual({ 0: { n: 0x28 }, 4: { field: 0x12, who: "mover", eor: 0x40 } });
    expect(called(cpu).scratch).toEqual({});
  });

  it("follows Y loaded from a field through TAY", () => {
    expect(run(ins("LDA", "dx", 0x17), ins("TAY", "imp")).regs.yFrom).toEqual({ field: 0x17, plus: 0 });
  });
});
