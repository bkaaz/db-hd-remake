import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROM_PATH } from "../rom/cartridge";
import { apuUpload } from "../rom/apuUpload";
import { Apu, SAMPLE_RATE } from "./apu";

/** A program at $0200 run for `steps` instructions. */
function run(program: number[], steps: number): Apu {
  const apu = new Apu();
  apu.load([{ blocks: [{ at: 0x200, bytes: Uint8Array.from(program) }], start: 0x200 }]);
  for (let i = 0; i < steps; i++) apu.cpu.step();
  return apu;
}

describe("the SPC700", () => {
  it("adds with carry and overflow: 0x7F + 0x01 is 0x80, V set, C clear", () => {
    const { cpu } = run([0xe8, 0x7f, 0x88, 0x01], 2); // MOV A,#$7F; ADC A,#$01
    expect(cpu.a).toBe(0x80);
    expect(cpu.psw & 0x40).toBe(0x40);
    expect(cpu.psw & 0x01).toBe(0);
  });

  it("divides YA by X: 1000 / 7 is 142 remainder 6", () => {
    const { cpu } = run([0xe8, 0xe8, 0x8d, 0x03, 0xcd, 0x07, 0x9e], 4); // A=$E8 Y=$03 X=7; DIV
    expect([cpu.a, cpu.y]).toEqual([142, 6]);
  });

  it("writes the DSP through $F2/$F3 and the game's port through $F5", () => {
    const apu = run([0x8f, 0x5d, 0xf2, 0x8f, 0x12, 0xf3, 0x8f, 0x34, 0xf5], 3);
    expect(apu.dsp.read(0x5d)).toBe(0x12);
    expect(apu.output[1]).toBe(0x34);
  });
});

// The cartridge's driver on our chip: silent until the game asks, then a sound.
describe.skipIf(!existsSync(ROM_PATH))("the cartridge's sound driver", () => {
  const rom = new Uint8Array(readFileSync(ROM_PATH));
  const peak = (pcm: Int16Array) => pcm.reduce((m, s) => Math.max(m, Math.abs(s)), 0);

  it("plays the hit (09) when its id is put in port 1, and nothing before", () => {
    const apu = new Apu();
    apu.load([0, 1, 2, 3].map((i) => apuUpload(rom, i)));
    expect(peak(apu.render(SAMPLE_RATE / 2))).toBe(0);
    apu.input[1] = 0x09;
    expect(peak(apu.render(SAMPLE_RATE / 2))).toBeGreaterThan(4000);
  });
});
