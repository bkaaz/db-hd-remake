/**
 * The SNES sound chip's DSP: eight voices of BRR samples, each with a pitch,
 * an envelope and a volume, plus noise, pitch modulation and the echo. One
 * call to `sample()` is one 32 kHz stereo frame. Per sample, not per cycle:
 * what a register write changes is heard from the next sample. Arithmetic
 * after fullsnes; the interpolation is a computed Gaussian close to the
 * chip's table, not the table itself (`gauss.ts`).
 */

import { GAUSS } from "./gauss";

/** Samples between steps of an envelope, by rate (0: never). */
const RATE = [
  0, 2048, 1536, 1280, 1024, 768, 640, 512, 384, 320, 256, 192, 160, 128, 96, 80,
  64, 48, 40, 32, 24, 20, 16, 12, 10, 8, 6, 5, 4, 3, 2, 1,
];

const clamp16 = (v: number) => (v < -32768 ? -32768 : v > 32767 ? 32767 : v);

type EnvMode = "attack" | "decay" | "sustain" | "release";

class Voice {
  /** The decoded samples of the block being played, behind the 3 kept from the last. */
  buf = new Int16Array(19);
  /** Pitch counter: 12 bits of fraction into `buf[3..]`. */
  pos = 0;
  brrAt = 0;
  p1 = 0;
  p2 = 0;
  env = 0;
  mode: EnvMode = "release";
  /** Samples left before a keyed-on voice sounds. */
  delay = 0;
  out = 0;
}

export class Dsp {
  readonly regs = new Uint8Array(128);
  private voices = Array.from({ length: 8 }, () => new Voice());
  private counter = 0;
  private everyOther = false;
  private konLatch = 0;
  private noise = 0x4000;
  private echoPos = 0;
  private echoHist: [number, number][] = Array.from({ length: 8 }, () => [0, 0]);
  private histPos = 0;

  constructor(private ram: Uint8Array) {}

  read(addr: number): number {
    return this.regs[addr & 0x7f];
  }

  write(addr: number, v: number): void {
    if (addr >= 0x80) return;
    this.regs[addr] = v;
    if (addr === 0x4c) this.konLatch = v;
    if (addr === 0x7c) this.regs[0x7c] = 0; // writing ENDX clears it
  }

  private s8(addr: number): number {
    return (this.regs[addr] << 24) >> 24;
  }

  /** One stereo sample. */
  sample(): [number, number] {
    const r = this.regs;
    const flg = r[0x6c];
    this.counter = (this.counter + 1) % 30720;
    this.everyOther = !this.everyOther;
    if (this.everyOther) {
      const kon = this.konLatch;
      this.konLatch = 0;
      for (let i = 0; i < 8; i++) if (kon & (1 << i)) this.keyOn(i);
    }
    if (this.fires(flg & 31)) {
      const fb = ((this.noise << 13) ^ (this.noise << 14)) & 0x4000;
      this.noise = fb ^ (this.noise >> 1);
    }

    let mainL = 0, mainR = 0, echoL = 0, echoR = 0;
    let prevOut = 0;
    for (let i = 0; i < 8; i++) {
      const v = this.voices[i];
      const base = i << 4;
      if (flg & 0x80) {
        v.mode = "release";
        v.env = 0;
      } else if (r[0x5c] & (1 << i)) {
        v.mode = "release";
      }
      let pitch = r[base + 2] | ((r[base + 3] & 0x3f) << 8);
      if (i > 0 && r[0x2d] & (1 << i)) pitch += ((prevOut >> 5) * pitch) >> 10;
      pitch = Math.max(0, Math.min(0x3fff, pitch));

      let out = 0;
      if (v.delay > 0) {
        v.delay--;
      } else {
        const sample = r[0x3d] & (1 << i) ? ((this.noise << 17) >> 16) : this.interpolate(v);
        this.envelope(v, base);
        out = ((sample * v.env) >> 11) & ~1;
        this.advance(v, i, pitch);
      }
      v.out = out;
      prevOut = out;
      r[base + 8] = v.env >> 4;
      r[base + 9] = (out >> 8) & 0xff;

      const l = (out * this.s8(base)) >> 7;
      const rr = (out * this.s8(base + 1)) >> 7;
      mainL = clamp16(mainL + l);
      mainR = clamp16(mainR + rr);
      if (r[0x4d] & (1 << i)) {
        echoL = clamp16(echoL + l);
        echoR = clamp16(echoR + rr);
      }
    }

    const [firL, firR] = this.echo(echoL, echoR, flg);
    let outL = clamp16(((mainL * this.s8(0x0c)) >> 7) + ((firL * this.s8(0x2c)) >> 7));
    let outR = clamp16(((mainR * this.s8(0x1c)) >> 7) + ((firR * this.s8(0x3c)) >> 7));
    if (flg & 0x40) outL = outR = 0;
    return [outL, outR];
  }

  /** Whether an event at `rate` falls on this sample. */
  private fires(rate: number): boolean {
    return rate !== 0 && this.counter % RATE[rate] === 0;
  }

  private keyOn(i: number): void {
    const v = this.voices[i];
    const dir = this.regs[0x5d] << 8;
    const srcn = this.regs[(i << 4) + 4];
    const at = (dir + 4 * srcn) & 0xffff;
    v.brrAt = this.ram[at] | (this.ram[(at + 1) & 0xffff] << 8);
    v.p1 = v.p2 = 0;
    v.buf.fill(0);
    v.pos = 0;
    v.env = 0;
    v.mode = "attack";
    v.delay = 5;
    this.regs[0x7c] &= ~(1 << i);
    this.decodeBlock(v, i);
  }

  /** The next 16 samples of a voice's BRR, after the 3 last kept for interpolation. */
  private decodeBlock(v: Voice, i: number): void {
    const ram = this.ram;
    v.buf.copyWithin(0, 16, 19);
    const header = ram[v.brrAt];
    const shift = header >> 4;
    const filter = (header >> 2) & 3;
    for (let n = 0; n < 16; n++) {
      const byte = ram[(v.brrAt + 1 + (n >> 1)) & 0xffff];
      let s = n & 1 ? byte & 0x0f : byte >> 4;
      if (s >= 8) s -= 16;
      s = shift <= 12 ? (s << shift) >> 1 : s < 0 ? -2048 : 0;
      const p1 = v.p1, p2 = v.p2;
      if (filter === 1) s += p1 + (-p1 >> 4);
      else if (filter === 2) s += 2 * p1 + ((-3 * p1) >> 5) - p2 + (p2 >> 4);
      else if (filter === 3) s += 2 * p1 + ((-13 * p1) >> 6) - p2 + ((3 * p2) >> 4);
      s = (clamp16(s) << 17) >> 17; // 15 bits, wrapping as the chip does
      v.buf[3 + n] = s;
      v.p2 = p1;
      v.p1 = s;
    }
    if (header & 1) {
      this.regs[0x7c] |= 1 << i;
      if (header & 2) {
        const dir = this.regs[0x5d] << 8;
        const at = (dir + 4 * this.regs[(i << 4) + 4] + 2) & 0xffff;
        v.brrAt = this.ram[at] | (this.ram[(at + 1) & 0xffff] << 8);
      } else {
        v.mode = "release";
        v.env = 0;
      }
    } else {
      v.brrAt = (v.brrAt + 9) & 0xffff;
    }
  }

  private interpolate(v: Voice): number {
    const idx = (v.pos >> 12) + 3;
    const f = (v.pos >> 4) & 0xff;
    const s = v.buf;
    let out = (GAUSS[255 - f] * s[idx - 3]) >> 11;
    out += (GAUSS[511 - f] * s[idx - 2]) >> 11;
    out += (GAUSS[256 + f] * s[idx - 1]) >> 11;
    out += (GAUSS[f] * s[idx]) >> 11;
    return clamp16(out * 2);
  }

  private advance(v: Voice, i: number, pitch: number): void {
    v.pos += pitch;
    while (v.pos >= 0x10000) {
      v.pos -= 0x10000;
      this.decodeBlock(v, i);
    }
  }

  /** One step of the envelope, after the chip: the level is worked out every sample, kept only when its rate fires. */
  private envelope(v: Voice, base: number): void {
    const r = this.regs;
    if (v.mode === "release") {
      v.env = Math.max(0, v.env - 8);
      return;
    }
    const adsr1 = r[base + 5];
    const adsr2 = r[base + 6];
    let env = v.env;
    let rate: number;
    if (adsr1 & 0x80) {
      if (v.mode === "attack") {
        rate = ((adsr1 & 15) << 1) + 1;
        env += rate < 31 ? 0x20 : 0x400;
      } else {
        env -= ((env - 1) >> 8) + 1;
        rate = v.mode === "decay" ? ((adsr1 >> 3) & 0x0e) + 0x10 : adsr2 & 31;
      }
    } else {
      const gain = r[base + 7];
      if (!(gain & 0x80)) {
        env = (gain & 0x7f) << 4;
        rate = 31;
      } else {
        rate = gain & 31;
        const mode = (gain >> 5) & 3;
        if (mode === 0) env -= 0x20;
        else if (mode === 1) env -= ((env - 1) >> 8) + 1;
        else if (mode === 2) env += 0x20;
        else env += v.env < 0x600 ? 0x20 : 0x08;
      }
    }
    if (env >> 8 === adsr2 >> 5 && v.mode === "decay") v.mode = "sustain";
    if (env < 0 || env > 0x7ff) {
      env = env < 0 ? 0 : 0x7ff;
      if (v.mode === "attack") v.mode = "decay";
    }
    if (this.fires(rate)) v.env = env;
  }

  /** The echo: what it plays from its buffer, and what it writes back into it. */
  private echo(inL: number, inR: number, flg: number): [number, number] {
    const r = this.regs;
    const base = r[0x6d] << 8;
    const at = (base + this.echoPos) & 0xffff;
    const rd = (a: number) => ((this.ram[a & 0xffff] | (this.ram[(a + 1) & 0xffff] << 8)) << 16) >> 16;
    this.histPos = (this.histPos + 1) & 7;
    this.echoHist[this.histPos] = [rd(at) >> 1, rd(at + 2) >> 1];
    let firL = 0, firR = 0;
    for (let k = 0; k < 8; k++) {
      const [hl, hr] = this.echoHist[(this.histPos + k + 1) & 7];
      const c = this.s8((k << 4) | 0x0f);
      firL += (hl * c) >> 6;
      firR += (hr * c) >> 6;
    }
    firL = clamp16(firL);
    firR = clamp16(firR);
    if (!(flg & 0x20)) {
      const efb = this.s8(0x0d);
      const wl = clamp16(inL + ((firL * efb) >> 7)) & ~1;
      const wr = clamp16(inR + ((firR * efb) >> 7)) & ~1;
      this.ram[at] = wl & 0xff;
      this.ram[(at + 1) & 0xffff] = (wl >> 8) & 0xff;
      this.ram[(at + 2) & 0xffff] = wr & 0xff;
      this.ram[(at + 3) & 0xffff] = (wr >> 8) & 0xff;
    }
    const length = (r[0x7d] & 15) * 0x800 || 4;
    this.echoPos += 4;
    if (this.echoPos >= length) this.echoPos = 0;
    return [firL, firR];
  }
}
