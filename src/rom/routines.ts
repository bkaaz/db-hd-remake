import type { Cpu, Value, Who } from "./cpu";
import type { HandlerFact } from "./handler";

/**
 * The engine's routines a move's handler calls, by what they do — read with
 * the arguments the handler loads before the call, and, for one that answers
 * in the carry, what each answer means for the code after it. `handler.ts`
 * walks the handler; this is what it knows of what it meets. A routine not
 * here is not followed, so what it does stays unread (the address is in the
 * report).
 */

export interface Routine {
  /** The fact the call is, read off its arguments; null when they were not known, or it is no fact. */
  fact: (c: Cpu) => Omit<HandlerFact, "frame"> | null;
  /** For a routine that answers in the carry: what the code after a set or a clear carry runs under. */
  carry?: (c: Cpu) => { set: string; clear: string };
  /** Walk into it too, for what it does to the whole game — the shake it starts. */
  follow?: boolean;
  /** It leaves Y pointing at this fighter's block. */
  yWho?: Who;
  /** It leaves the scratch bytes as they were. */
  keeps?: boolean;
}

const hex = (n: number) => n.toString(16).padStart(2, "0");
const says = (what: string): Routine => ({ fact: () => ({ what }) });

/** `$0D:EBE0`'s Y: the type in the low nibble, the animation in the high byte (`AND #$FF0F`). */
const object = ({ regs: r }: Cpu) => (r.y === null ? "its object" : `its object ${hex(r.y & 0x0f)}/${hex(r.y >> 8)}`);

/** Field 0x17: the fighter's own palette. */
const OWN_PALETTE = 0x17;

function palette({ regs: r }: Cpu): string {
  if (r.yFrom?.field !== OWN_PALETTE) return r.y === null ? "loads a palette" : `loads palette ${r.y.toString(16)}`;
  return r.yFrom.plus ? `loads its own palette + ${r.yFrom.plus}` : "loads its own palette back";
}

/** A constant the handler left in a scratch byte, or null. */
function word(c: Cpu, at: number): number | null {
  const v = c.scratch[at];
  return v && "n" in v ? v.n : null;
}

function launch(c: Cpu): Omit<HandlerFact, "frame"> | null {
  const [damage, move, vx, vy, stun] = [0, 2, 6, 8, 0x0a].map((at) => word(c, at));
  const facing: Value | undefined = c.scratch[4];
  if ([damage, move, vx, vy, stun].includes(null) || !facing) return null;
  const signed = (n: number) => ((n << 16) >> 16) / 256;
  return { what: "throws the opponent", launch: { damage: damage!, stun: stun!, move: move! & 0xff, vx: signed(vx!), vy: signed(vy!), facing } };
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
  0x0dd82e: { fact: ({ regs: r }) => (r.a === null ? null : { what: "plays sound", sound: r.a & 0xff }) },
  // the move id in A
  0x018518: { fact: ({ regs: r }) => (r.a === null ? null : { what: "sets move", move: r.a & 0xff }) },
  // the palette in Y, for this player's sprites
  0x018316: { fact: (c) => ({ what: palette(c) }) },
  // Y = X ^ 0300: the other fighter's block
  0x0dd7db: { fact: () => null, yWho: "opponent", keeps: true },
  // an opponent in move 30 put at the mover's x/y plus the table at [$00]
  // (one pointer per opponent's character, then dx, dy by the mover's step)
  0x0dde9a: { fact: (c) => (word(c, 0) === null || word(c, 2) === null ? null : { what: "holds the opponent", hold: ((word(c, 2)! & 0xff) << 16) | word(c, 0)! }) },
  // the opponent thrown: $00 damage (less defence, $0D:D12E), $0A off the
  // stun gauge, $02 its move — KO (1c) at 0 health, dizzy (1d) when the
  // gauge runs out instead — $04 facing, $06 vx, $08 vy
  0x0fb321: { fact: (c) => launch(c) },
};
