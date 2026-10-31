import type { HandlerFact } from "./handler";

/**
 * The engine's routines a move's handler calls, by what they do — read with
 * the arguments the handler loads before the call, and, for one that answers
 * in the carry, what each answer means for the code after it. `handler.ts`
 * walks the handler; this is what it knows of what it meets. A routine not
 * here is not followed, so what it does stays unread (the address is in the
 * report).
 */

/** What the handler had loaded when it called: a constant, or null if it was not one. */
export interface Registers {
  a: number | null;
  y: number | null;
  /** Y as a fighter field plus a count of `INY` — a palette field and the one 8 after it. */
  yFrom?: { field: number; plus: number };
}

export interface Routine {
  /** The fact the call is, read off its arguments; null when they were not constants. */
  fact: (r: Registers) => Omit<HandlerFact, "frame"> | null;
  /** For a routine that answers in the carry: what the code after a set or a clear carry runs under. */
  carry?: (r: Registers) => { set: string; clear: string };
  /** Walk into it too, for what it does to the whole game — the shake it starts. */
  follow?: boolean;
}

const hex = (n: number) => n.toString(16).padStart(2, "0");
const says = (what: string): Routine => ({ fact: () => ({ what }) });

/** `$0D:EBE0`'s Y: the type in the low nibble, the animation in the high byte (`AND #$FF0F`). */
const object = (r: Registers) => (r.y === null ? "its object" : `its object ${hex(r.y & 0x0f)}/${hex(r.y >> 8)}`);

/** Field 0x17: the fighter's own palette. */
const OWN_PALETTE = 0x17;

function palette(r: Registers): string {
  if (r.yFrom?.field !== OWN_PALETTE) return r.y === null ? "loads a palette" : `loads palette ${r.y.toString(16)}`;
  return r.yFrom.plus ? `loads its own palette + ${r.yFrom.plus}` : "loads its own palette back";
}

export const ROUTINES: Record<number, Routine> = {
  0x0dd8a2: says("re-arms the blow"),
  0x0f9fa3: says("ends the move"),
  0x0dd7a0: says("stops"),
  0x0dde6c: says("raises dust"),
  // vy = −¼ of the landing's, at least 2.0 up; and a shake
  0x0dec12: { ...says("bounces"), follow: true },
  0x0dec5f: says("slows the shove"),
  // SEC once on the floor
  0x0dcb47: {
    fact: () => ({ what: "asks whether it has landed" }),
    carry: () => ({ set: "once it has landed", clear: "until it lands" }),
  },
  // through the owner's object slots; SEC when none matches
  0x0debe0: {
    fact: (r) => ({ what: `looks for ${object(r)}` }),
    carry: (r) => ({ set: `when ${object(r)} is gone`, clear: `while ${object(r)} is up` }),
  },
  // the sound id in A (docs/rom.md)
  0x0dd82e: { fact: (r) => (r.a === null ? null : { what: "plays sound", sound: r.a & 0xff }) },
  // the move id in A
  0x018518: { fact: (r) => (r.a === null ? null : { what: "sets move", move: r.a & 0xff }) },
  // the palette in Y, for this player's sprites
  0x018316: { fact: (r) => ({ what: palette(r) }) },
};
