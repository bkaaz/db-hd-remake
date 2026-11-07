/**
 * The SNES sound chip's CPU, the SPC700: runs the cartridge's own sound
 * driver, so every effect sounds as the driver plays it rather than as we
 * guess it does. Instruction-level, not cycle-level: each instruction takes
 * its documented count of cycles at once, which is all the timers and the DSP
 * can tell apart. Arithmetic and flags after fullsnes.
 */

export interface Bus {
  read(addr: number): number;
  write(addr: number, value: number): void;
}

/** Cycles per opcode, before a branch is taken (+2). */
const CYCLES = [
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 5, 4, 5, 4, 6, 8, // 0x
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 6, 5, 2, 2, 4, 6, // 1x
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 5, 4, 5, 4, 5, 2, // 2x (BRA: 2 + taken)
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 6, 5, 2, 2, 3, 8, // 3x
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 4, 4, 5, 4, 6, 6, // 4x
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 4, 5, 2, 2, 4, 3, // 5x
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 4, 4, 5, 4, 5, 5, // 6x
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 5, 5, 2, 2, 3, 6, // 7x
  2, 8, 4, 5, 3, 4, 3, 6, 2, 6, 5, 4, 5, 2, 4, 5, // 8x
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 5, 5, 2, 2, 12, 5, // 9x
  3, 8, 4, 5, 3, 4, 3, 6, 2, 6, 4, 4, 5, 2, 4, 4, // Ax
  2, 8, 4, 5, 4, 5, 5, 6, 5, 5, 5, 5, 2, 2, 3, 4, // Bx
  3, 8, 4, 5, 4, 5, 4, 7, 2, 5, 6, 4, 5, 2, 4, 9, // Cx
  2, 8, 4, 5, 5, 6, 6, 7, 4, 5, 5, 5, 2, 2, 6, 3, // Dx
  2, 8, 4, 5, 3, 4, 3, 6, 2, 4, 5, 3, 4, 3, 4, 3, // Ex
  2, 8, 4, 5, 4, 5, 5, 6, 3, 4, 5, 4, 2, 2, 4, 3, // Fx
];

const N = 0x80, V = 0x40, P = 0x20, B = 0x10, H = 0x08, I = 0x04, Z = 0x02, C = 0x01;

export class Spc700 {
  a = 0;
  x = 0;
  y = 0;
  sp = 0xef;
  pc = 0;
  psw = 0;
  /** SLEEP or STOP: nothing runs again. */
  halted = false;

  constructor(private bus: Bus) {}

  /** One instruction; returns the cycles it took. */
  step(): number {
    if (this.halted) return 2;
    const op = this.fetch();
    const extra = this.exec(op);
    return CYCLES[op] + extra;
  }

  // --- memory ---

  private fetch(): number {
    const v = this.bus.read(this.pc);
    this.pc = (this.pc + 1) & 0xffff;
    return v;
  }
  private fetch16(): number {
    const lo = this.fetch();
    return lo | (this.fetch() << 8);
  }
  private rd(addr: number): number {
    return this.bus.read(addr & 0xffff);
  }
  private wr(addr: number, v: number): void {
    this.bus.write(addr & 0xffff, v & 0xff);
  }
  /** A direct-page address: page 0, or page 1 with P set. */
  private dp(d: number): number {
    return (this.psw & P ? 0x100 : 0) | (d & 0xff);
  }
  private rd16dp(d: number): number {
    return this.rd(this.dp(d)) | (this.rd(this.dp(d + 1)) << 8);
  }
  private push(v: number): void {
    this.wr(0x100 | this.sp, v);
    this.sp = (this.sp - 1) & 0xff;
  }
  private pop(): number {
    this.sp = (this.sp + 1) & 0xff;
    return this.rd(0x100 | this.sp);
  }

  // --- flags ---

  private nz(v: number): number {
    this.psw = (this.psw & ~(N | Z)) | (v & 0x80) | ((v & 0xff) === 0 ? Z : 0);
    return v & 0xff;
  }
  private nz16(v: number): void {
    this.psw = (this.psw & ~(N | Z)) | ((v >> 8) & 0x80) | ((v & 0xffff) === 0 ? Z : 0);
  }
  private flag(f: number, on: boolean | number): void {
    this.psw = on ? this.psw | f : this.psw & ~f;
  }

  // --- arithmetic ---

  private adc(a: number, b: number): number {
    const r = a + b + (this.psw & C);
    this.flag(C, r > 0xff);
    this.flag(V, ~(a ^ b) & (a ^ r) & 0x80);
    this.flag(H, (a ^ b ^ r) & 0x10);
    return this.nz(r);
  }
  private sbc(a: number, b: number): number {
    return this.adc(a, b ^ 0xff);
  }
  private cmp(a: number, b: number): void {
    const r = a - b;
    this.flag(C, r >= 0);
    this.nz(r);
  }
  private asl(v: number): number {
    this.flag(C, v & 0x80);
    return this.nz(v << 1);
  }
  private lsr(v: number): number {
    this.flag(C, v & 1);
    return this.nz(v >> 1);
  }
  private rol(v: number): number {
    const c = this.psw & C;
    this.flag(C, v & 0x80);
    return this.nz((v << 1) | c);
  }
  private ror(v: number): number {
    const c = this.psw & C;
    this.flag(C, v & 1);
    return this.nz((v >> 1) | (c << 7));
  }

  /** An 8-bit operation on A and a value, by the high nibble of the column 4–8 opcodes. */
  private alu(row: number, a: number, b: number): number {
    switch (row) {
      case 0: return this.nz(a | b);
      case 1: return this.nz(a & b);
      case 2: return this.nz(a ^ b);
      case 3: this.cmp(a, b); return a;
      case 4: return this.adc(a, b);
      default: return this.sbc(a, b);
    }
  }

  private branch(cond: boolean): number {
    const rel = this.fetch();
    if (!cond) return 0;
    this.pc = (this.pc + ((rel << 24) >> 24)) & 0xffff;
    return 2;
  }

  /** The 13-bit address and bit number of the `m.b` operand. */
  private memBit(): [number, number] {
    const w = this.fetch16();
    return [w & 0x1fff, w >> 13];
  }

  private exec(op: number): number {
    const hi = op >> 4;
    const lo = op & 15;

    // the regular block: columns 4–9 of rows 0–B are the ALU over every addressing mode
    if (hi <= 0xb && lo >= 4 && lo <= 9 && !(lo === 8 && hi >= 0xc) && !(lo === 9 && hi >= 0xc)) {
      const row = hi >> 1;
      const odd = hi & 1;
      if (lo === 8 && odd) {
        // d,#i
        const i = this.fetch();
        const d = this.dp(this.fetch());
        const r = this.alu(row, this.rd(d), i);
        if (row !== 3) this.wr(d, r);
        return 0;
      }
      if (lo === 9) {
        let dst: number, src: number;
        if (odd) {
          dst = this.dp(this.x);
          src = this.rd(this.dp(this.y));
        } else {
          src = this.rd(this.dp(this.fetch()));
          dst = this.dp(this.fetch());
        }
        const r = this.alu(row, this.rd(dst), src);
        if (row !== 3) this.wr(dst, r);
        return 0;
      }
      const b = this.rd(this.operand(lo, odd));
      this.a = this.alu(row, this.a, b);
      return 0;
    }

    if (lo === 1) {
      // TCALL n
      this.push(this.pc >> 8);
      this.push(this.pc & 0xff);
      const at = 0xffde - 2 * hi;
      this.pc = this.rd(at) | (this.rd(at + 1) << 8);
      return 0;
    }
    if (lo === 2) {
      const d = this.dp(this.fetch());
      const bit = 1 << (hi >> 1);
      this.wr(d, hi & 1 ? this.rd(d) & ~bit : this.rd(d) | bit);
      return 0;
    }
    if (lo === 3) {
      const v = this.rd(this.dp(this.fetch()));
      const set = (v >> (hi >> 1)) & 1;
      return this.branch(hi & 1 ? !set : !!set);
    }

    switch (op) {
      // --- column 0: flags and branches ---
      case 0x00: return 0;
      case 0x10: return this.branch(!(this.psw & N));
      case 0x20: this.flag(P, false); return 0;
      case 0x30: return this.branch(!!(this.psw & N));
      case 0x40: this.flag(P, true); return 0;
      case 0x50: return this.branch(!(this.psw & V));
      case 0x60: this.flag(C, false); return 0;
      case 0x70: return this.branch(!!(this.psw & V));
      case 0x80: this.flag(C, true); return 0;
      case 0x90: return this.branch(!(this.psw & C));
      case 0xa0: this.flag(I, true); return 0;
      case 0xb0: return this.branch(!!(this.psw & C));
      case 0xc0: this.flag(I, false); return 0;
      case 0xd0: return this.branch(!(this.psw & Z));
      case 0xe0: this.flag(V | H, false); return 0;
      case 0xf0: return this.branch(!!(this.psw & Z));

      // --- MOV to memory (no flags) ---
      case 0xc4: this.wr(this.dp(this.fetch()), this.a); return 0;
      case 0xd4: this.wr(this.dp(this.fetch() + this.x), this.a); return 0;
      case 0xc5: this.wr(this.fetch16(), this.a); return 0;
      case 0xd5: this.wr(this.fetch16() + this.x, this.a); return 0;
      case 0xc6: this.wr(this.dp(this.x), this.a); return 0;
      case 0xd6: this.wr(this.fetch16() + this.y, this.a); return 0;
      case 0xc7: this.wr(this.rd16dp(this.fetch() + this.x), this.a); return 0;
      case 0xd7: this.wr(this.rd16dp(this.fetch()) + this.y, this.a); return 0;
      case 0xd8: this.wr(this.dp(this.fetch()), this.x); return 0;
      case 0xd9: this.wr(this.dp(this.fetch() + this.y), this.x); return 0;
      case 0xc9: this.wr(this.fetch16(), this.x); return 0;
      case 0xcb: this.wr(this.dp(this.fetch()), this.y); return 0;
      case 0xdb: this.wr(this.dp(this.fetch() + this.x), this.y); return 0;
      case 0xcc: this.wr(this.fetch16(), this.y); return 0;
      case 0xaf: this.wr(this.dp(this.x), this.a); this.x = (this.x + 1) & 0xff; return 0;
      case 0x8f: { const i = this.fetch(); this.wr(this.dp(this.fetch()), i); return 0; }
      case 0xfa: { const v = this.rd(this.dp(this.fetch())); this.wr(this.dp(this.fetch()), v); return 0; }

      // --- MOV to registers ---
      case 0xe4: this.a = this.nz(this.rd(this.dp(this.fetch()))); return 0;
      case 0xf4: this.a = this.nz(this.rd(this.dp(this.fetch() + this.x))); return 0;
      case 0xe5: this.a = this.nz(this.rd(this.fetch16())); return 0;
      case 0xf5: this.a = this.nz(this.rd(this.fetch16() + this.x)); return 0;
      case 0xe6: this.a = this.nz(this.rd(this.dp(this.x))); return 0;
      case 0xf6: this.a = this.nz(this.rd(this.fetch16() + this.y)); return 0;
      case 0xe7: this.a = this.nz(this.rd(this.rd16dp(this.fetch() + this.x))); return 0;
      case 0xf7: this.a = this.nz(this.rd(this.rd16dp(this.fetch()) + this.y)); return 0;
      case 0xe8: this.a = this.nz(this.fetch()); return 0;
      case 0xbf: this.a = this.nz(this.rd(this.dp(this.x))); this.x = (this.x + 1) & 0xff; return 0;
      case 0xf8: this.x = this.nz(this.rd(this.dp(this.fetch()))); return 0;
      case 0xf9: this.x = this.nz(this.rd(this.dp(this.fetch() + this.y))); return 0;
      case 0xe9: this.x = this.nz(this.rd(this.fetch16())); return 0;
      case 0xcd: this.x = this.nz(this.fetch()); return 0;
      case 0xeb: this.y = this.nz(this.rd(this.dp(this.fetch()))); return 0;
      case 0xfb: this.y = this.nz(this.rd(this.dp(this.fetch() + this.x))); return 0;
      case 0xec: this.y = this.nz(this.rd(this.fetch16())); return 0;
      case 0x8d: this.y = this.nz(this.fetch()); return 0;
      case 0x5d: this.x = this.nz(this.a); return 0;
      case 0x7d: this.a = this.nz(this.x); return 0;
      case 0xdd: this.a = this.nz(this.y); return 0;
      case 0xfd: this.y = this.nz(this.a); return 0;
      case 0x9d: this.x = this.nz(this.sp); return 0;
      case 0xbd: this.sp = this.x; return 0;

      // --- compares of X and Y ---
      case 0xc8: this.cmp(this.x, this.fetch()); return 0;
      case 0x3e: this.cmp(this.x, this.rd(this.dp(this.fetch()))); return 0;
      case 0x1e: this.cmp(this.x, this.rd(this.fetch16())); return 0;
      case 0xad: this.cmp(this.y, this.fetch()); return 0;
      case 0x7e: this.cmp(this.y, this.rd(this.dp(this.fetch()))); return 0;
      case 0x5e: this.cmp(this.y, this.rd(this.fetch16())); return 0;

      // --- shifts, INC, DEC ---
      case 0x0b: case 0x1b: case 0x0c:
      case 0x2b: case 0x3b: case 0x2c:
      case 0x4b: case 0x5b: case 0x4c:
      case 0x6b: case 0x7b: case 0x6c:
      case 0x8b: case 0x9b: case 0x8c:
      case 0xab: case 0xbb: case 0xac: {
        const at = lo === 0xc ? this.fetch16() : this.dp(this.fetch() + (hi & 1 ? this.x : 0));
        this.wr(at, this.rmw(hi >> 1, this.rd(at)));
        return 0;
      }
      case 0x1c: this.a = this.asl(this.a); return 0;
      case 0x3c: this.a = this.rol(this.a); return 0;
      case 0x5c: this.a = this.lsr(this.a); return 0;
      case 0x7c: this.a = this.ror(this.a); return 0;
      case 0x9c: this.a = this.nz(this.a - 1); return 0;
      case 0xbc: this.a = this.nz(this.a + 1); return 0;
      case 0x1d: this.x = this.nz(this.x - 1); return 0;
      case 0x3d: this.x = this.nz(this.x + 1); return 0;
      case 0xdc: this.y = this.nz(this.y - 1); return 0;
      case 0xfc: this.y = this.nz(this.y + 1); return 0;

      // --- 16-bit ---
      case 0x1a: case 0x3a: {
        const d = this.fetch();
        const v = (this.rd16dp(d) + (op === 0x3a ? 1 : -1)) & 0xffff;
        this.wr(this.dp(d), v & 0xff);
        this.wr(this.dp(d + 1), v >> 8);
        this.nz16(v);
        return 0;
      }
      case 0x5a: {
        const r = ((this.y << 8) | this.a) - this.rd16dp(this.fetch());
        this.flag(C, r >= 0);
        this.nz16(r & 0xffff);
        return 0;
      }
      case 0x7a: case 0x9a: {
        const ya = (this.y << 8) | this.a;
        const w = this.rd16dp(this.fetch());
        let r: number;
        if (op === 0x7a) {
          r = ya + w;
          this.flag(C, r > 0xffff);
          this.flag(V, ~(ya ^ w) & (ya ^ r) & 0x8000);
          this.flag(H, (ya ^ w ^ r) & 0x1000);
        } else {
          r = ya - w;
          this.flag(C, r >= 0);
          this.flag(V, (ya ^ w) & (ya ^ r) & 0x8000);
          this.flag(H, !((ya ^ w ^ r) & 0x1000));
        }
        r &= 0xffff;
        this.nz16(r);
        this.a = r & 0xff;
        this.y = r >> 8;
        return 0;
      }
      case 0xba: {
        const v = this.rd16dp(this.fetch());
        this.a = v & 0xff;
        this.y = v >> 8;
        this.nz16(v);
        return 0;
      }
      case 0xda: {
        const d = this.fetch();
        this.wr(this.dp(d), this.a);
        this.wr(this.dp(d + 1), this.y);
        return 0;
      }

      // --- single bits of memory ---
      case 0x0a: case 0x2a: case 0x4a: case 0x6a: case 0x8a: case 0xaa: {
        const [at, bit] = this.memBit();
        let b = (this.rd(at) >> bit) & 1;
        if (op === 0x2a || op === 0x6a) b ^= 1;
        const c = this.psw & C;
        this.flag(C, op === 0x0a || op === 0x2a ? c | b : op === 0x4a || op === 0x6a ? c & b : op === 0x8a ? c ^ b : b);
        return 0;
      }
      case 0xca: {
        const [at, bit] = this.memBit();
        const v = this.rd(at);
        this.wr(at, this.psw & C ? v | (1 << bit) : v & ~(1 << bit));
        return 0;
      }
      case 0xea: {
        const [at, bit] = this.memBit();
        this.wr(at, this.rd(at) ^ (1 << bit));
        return 0;
      }
      case 0x0e: case 0x4e: {
        const at = this.fetch16();
        const v = this.rd(at);
        this.nz(this.a - v);
        this.wr(at, op === 0x0e ? v | this.a : v & ~this.a);
        return 0;
      }

      // --- stack ---
      case 0x0d: this.push(this.psw); return 0;
      case 0x2d: this.push(this.a); return 0;
      case 0x4d: this.push(this.x); return 0;
      case 0x6d: this.push(this.y); return 0;
      case 0x8e: this.psw = this.pop(); return 0;
      case 0xae: this.a = this.pop(); return 0;
      case 0xce: this.x = this.pop(); return 0;
      case 0xee: this.y = this.pop(); return 0;

      // --- jumps ---
      case 0x2f: return this.branch(true);
      case 0x5f: this.pc = this.fetch16(); return 0;
      case 0x1f: { const at = (this.fetch16() + this.x) & 0xffff; this.pc = this.rd(at) | (this.rd(at + 1) << 8); return 0; }
      case 0x3f: { const to = this.fetch16(); this.push(this.pc >> 8); this.push(this.pc & 0xff); this.pc = to; return 0; }
      case 0x4f: { const u = this.fetch(); this.push(this.pc >> 8); this.push(this.pc & 0xff); this.pc = 0xff00 | u; return 0; }
      case 0x6f: { const l = this.pop(); this.pc = l | (this.pop() << 8); return 0; }
      case 0x7f: { this.psw = this.pop(); const l = this.pop(); this.pc = l | (this.pop() << 8); return 0; }
      case 0x0f: {
        this.push(this.pc >> 8);
        this.push(this.pc & 0xff);
        this.push(this.psw);
        this.flag(B, true);
        this.flag(I, false);
        this.pc = this.rd(0xffde) | (this.rd(0xffdf) << 8);
        return 0;
      }
      case 0x2e: { const v = this.rd(this.dp(this.fetch())); return this.branch(this.a !== v); }
      case 0xde: { const v = this.rd(this.dp(this.fetch() + this.x)); return this.branch(this.a !== v); }
      case 0x6e: {
        const d = this.dp(this.fetch());
        const v = (this.rd(d) - 1) & 0xff;
        this.wr(d, v);
        return this.branch(v !== 0);
      }
      case 0xfe: this.y = (this.y - 1) & 0xff; return this.branch(this.y !== 0);

      // --- the rest ---
      case 0xed: this.psw ^= C; return 0;
      case 0x9f: this.a = this.nz((this.a >> 4) | ((this.a << 4) & 0xf0)); return 0;
      case 0xcf: {
        const r = this.y * this.a;
        this.a = r & 0xff;
        this.y = r >> 8;
        this.nz(this.y);
        return 0;
      }
      case 0x9e: {
        const ya = (this.y << 8) | this.a;
        const x = this.x;
        this.flag(V, this.y >= x);
        this.flag(H, (this.y & 15) >= (x & 15));
        if (this.y < x << 1) {
          this.a = Math.floor(ya / x) & 0xff;
          this.y = ya % x & 0xff;
        } else {
          this.a = (255 - Math.floor((ya - (x << 9)) / (256 - x))) & 0xff;
          this.y = (x + ((ya - (x << 9)) % (256 - x))) & 0xff;
        }
        this.nz(this.a);
        return 0;
      }
      case 0xdf: {
        if (this.psw & C || this.a > 0x99) { this.a = (this.a + 0x60) & 0xff; this.flag(C, true); }
        if (this.psw & H || (this.a & 15) > 9) this.a = (this.a + 6) & 0xff;
        this.nz(this.a);
        return 0;
      }
      case 0xbe: {
        if (!(this.psw & C) || this.a > 0x99) { this.a = (this.a - 0x60) & 0xff; this.flag(C, false); }
        if (!(this.psw & H) || (this.a & 15) > 9) this.a = (this.a - 6) & 0xff;
        this.nz(this.a);
        return 0;
      }
      case 0xef: case 0xff: this.halted = true; return 0;
    }
    throw new Error(`spc700: opcode ${op.toString(16)} not handled at ${(this.pc - 1).toString(16)}`);
  }

  /** The address of an ALU operand by column (4–7), the odd rows adding an index. */
  private operand(lo: number, odd: number): number {
    switch (lo) {
      case 4: return this.dp(this.fetch() + (odd ? this.x : 0));
      case 5: return (this.fetch16() + (odd ? this.x : 0)) & 0xffff;
      case 6: return odd ? (this.fetch16() + this.y) & 0xffff : this.dp(this.x);
      case 7: return odd ? (this.rd16dp(this.fetch()) + this.y) & 0xffff : this.rd16dp(this.fetch() + this.x);
      default: { // column 8, even rows: #i — the byte past the opcode
        const at = this.pc;
        this.pc = (this.pc + 1) & 0xffff;
        return at;
      }
    }
  }

  private rmw(kind: number, v: number): number {
    switch (kind) {
      case 0: return this.asl(v);
      case 1: return this.rol(v);
      case 2: return this.lsr(v);
      case 3: return this.ror(v);
      case 4: return this.nz(v - 1);
      default: return this.nz(v + 1);
    }
  }
}
