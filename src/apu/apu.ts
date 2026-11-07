/**
 * The sound chip whole: 64 KB of RAM, the SPC700 running the cartridge's
 * driver, the DSP, three timers and the four ports the game talks through.
 * The cartridge's uploads are put straight into RAM instead of being fed
 * through the boot ROM's handshake, which is Nintendo's and not ours to ship.
 */

import type { ApuUpload } from "../rom/apuUpload";
import { Dsp } from "./dsp";
import { Spc700 } from "./spc700";

/** CPU cycles per DSP sample: 1.024 MHz over 32 kHz. */
const CYCLES_PER_SAMPLE = 32;
export const SAMPLE_RATE = 32000;

export class Apu {
  readonly ram = new Uint8Array(0x10000);
  readonly dsp = new Dsp(this.ram);
  readonly cpu: Spc700;
  /** What the game last wrote to $2140–$2143, as the driver reads them at $F4–$F7. */
  readonly input = new Uint8Array(4);
  /** What the driver last wrote to $F4–$F7, as the game reads them. */
  readonly output = new Uint8Array(4);
  private dspAddr = 0;
  private timers = [0, 1, 2].map(() => ({ on: false, target: 0, count: 0, out: 0, stage: 0 }));
  private budget = 0;

  constructor() {
    this.cpu = new Spc700({ read: (a) => this.read(a), write: (a, v) => this.write(a, v) });
  }

  /** The uploads, in the order the game sends them; the driver starts where the last one says. */
  load(uploads: ApuUpload[]): void {
    for (const u of uploads) for (const b of u.blocks) for (let i = 0; i < b.bytes.length; i++) this.ram[(b.at + i) & 0xffff] = b.bytes[i];
    this.cpu.pc = uploads[uploads.length - 1].start;
  }

  /** `count` stereo samples at 32 kHz, interleaved left, right. */
  render(count: number): Int16Array {
    const out = new Int16Array(count * 2);
    for (let n = 0; n < count; n++) {
      this.budget += CYCLES_PER_SAMPLE;
      while (this.budget > 0) {
        const c = this.cpu.step();
        this.tick(c);
        this.budget -= c;
      }
      const [l, r] = this.dsp.sample();
      out[2 * n] = l;
      out[2 * n + 1] = r;
    }
    return out;
  }

  private tick(cycles: number): void {
    this.timers.forEach((t, i) => {
      if (!t.on) return;
      t.stage += cycles;
      const period = i === 2 ? 16 : 128;
      while (t.stage >= period) {
        t.stage -= period;
        t.count = (t.count + 1) & 0xff;
        if (t.count === t.target) {
          t.count = 0;
          t.out = (t.out + 1) & 15;
        }
      }
    });
  }

  private read(a: number): number {
    if (a < 0xf0 || a > 0xff) return this.ram[a];
    switch (a) {
      case 0xf2: return this.dspAddr;
      case 0xf3: return this.dsp.read(this.dspAddr);
      case 0xf4: case 0xf5: case 0xf6: case 0xf7: return this.input[a - 0xf4];
      case 0xfd: case 0xfe: case 0xff: {
        const t = this.timers[a - 0xfd];
        const v = t.out;
        t.out = 0;
        return v;
      }
      case 0xf8: case 0xf9: return this.ram[a];
      default: return 0;
    }
  }

  private write(a: number, v: number): void {
    if (a >= 0xf0 && a <= 0xff) this.io(a, v);
    this.ram[a] = v;
  }

  private io(a: number, v: number): void {
    switch (a) {
      case 0xf1:
        this.timers.forEach((t, i) => {
          const on = !!(v & (1 << i));
          if (on && !t.on) {
            t.count = 0;
            t.out = 0;
          }
          t.on = on;
        });
        if (v & 0x10) this.input[0] = this.input[1] = 0;
        if (v & 0x20) this.input[2] = this.input[3] = 0;
        return;
      case 0xf2: this.dspAddr = v; return;
      case 0xf3: this.dsp.write(this.dspAddr, v); return;
      case 0xf4: case 0xf5: case 0xf6: case 0xf7: this.output[a - 0xf4] = v; return;
      case 0xfa: case 0xfb: case 0xfc: this.timers[a - 0xfa].target = v; return;
    }
  }
}
