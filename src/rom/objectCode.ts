import { toFile } from "./cartridge";
import type { HandlerFact } from "./handler";
import { ROUTINES as SHARED, type Routine } from "./routines";
import type { Instruction } from "./disasm";
import { walk, type Body } from "./walk";

const hex = (n: number) => n.toString(16).padStart(2, "0");

/**
 * An object's code — what `$0F:B44B` runs for each live slot every frame —
 * read as a handler is (`walk.ts`), over the slot's fields: its timer is
 * the frame count, its animation picks the entry. What it reads: how long
 * it lives, when it steps to its next frame, what it waits on (the
 * hitstop, the game's frame count). docs/rom.md, An object's behaviour.
 */

/** `$0F:B467`: a 2-byte pointer per object type, in bank `$0F`. */
const TYPES = 0x0fb467;

/** A slot's fields (docs/rom.md). */
export const OBJECT_FIELDS: Record<number, string> = {
  0x00: "type (bit 7: alive)",
  0x01: "animation",
  0x02: "frame shown",
  0x03: "tile base",
  0x04: "attributes",
  0x0b: "timer",
  0x0c: "vx",
  0x0e: "vy",
};

const FRAME = 0x02;
const TIMER = 0x0b;

const ROUTINES: Record<number, Routine> = {
  // frees the slot: the object is gone
  0x0fb4ed: { fact: () => ({ what: "is gone" }) },
  // as its thrower: Y holds his block ($0F:B613)
  0x0dd82e: SHARED[0x0dd82e],
};

/** Its thrower's fields, read through Y after `$0F:B613`. */
const THROWER_X = 0x20;
const THROWER_Y = 0x23;
const THROWER_MOVE = 0x40;
const X = 0x06;
const Y = 0x09;
/** Type bit 6: the blow armed (docs/rom.md). */
const ARMED = 0x40;

/** The code type `type` runs, before any jump by animation. */
export function objectEntry(rom: Uint8Array, type: number): number {
  const at = toFile(TYPES + 2 * type);
  if (at === null) throw new Error("the type table is not ROM");
  return (TYPES & 0xff0000) | rom[at] | (rom[at + 1] << 8);
}

export function objectFacts(rom: Uint8Array, type: number, anim: number): HandlerFact[] {
  let seen: (Instruction | undefined)[] = [undefined, undefined, undefined];
  let thrower = false;
  const body: Body = {
    frames: TIMER,
    dispatch: { field: 0x01, entries: [anim], tagged: false },
    names: OBJECT_FIELDS,
    routines: ROUTINES,
    ownBanks: new Set([0x0f]),
    // the slot loop's next slot: the object's code has run
    stops: new Set([0x0fb47d]),
    observe(ins, cpu, add) {
      const [earlier, before, last] = seen;
      seen = [before, last, ins];
      const read = (i: typeof ins | undefined, field: number) => i?.mnemonic === "LDA" && i.mode === "ay" && i.operand === field;
      if (ins.mnemonic === "CMP" && ins.mode === "im" && (read(last, THROWER_MOVE) || (last?.mnemonic === "BEQ" && thrower)))
        add({ what: `tests its thrower's move for ${hex(ins.operand)}` });
      if (read(last, THROWER_MOVE) || (ins.mnemonic !== "CMP" && ins.mnemonic !== "BEQ")) thrower = read(last, THROWER_MOVE) || ins.mnemonic === "CMP";
      if (ins.mnemonic === "STA" && ins.operand === X && read(last, THROWER_X)) add({ what: "stays on its thrower's x" });
      if (ins.mnemonic === "STA" && ins.operand === Y && last?.mnemonic === "ADC" && (read(before, THROWER_Y) || read(earlier, THROWER_Y)))
        add({ what: `stays on its thrower's y, ${(last.operand << 16) >> 16} px` });
      if (ins.mnemonic === "STA" && ins.operand === 0 && last?.mnemonic === "ORA" && last.operand === ARMED) add({ what: "re-arms its blow" });
      if (ins.mode !== "dx") return;
      if (ins.mnemonic === "INC" && ins.operand === FRAME) add({ what: "shows its next frame" });
      if (ins.mnemonic === "STZ" && ins.operand === TIMER) add({ what: "restarts its timer" });
      if (ins.mnemonic === "STZ" && ins.operand === FRAME) add({ what: "shows frame 0" });
      if (ins.mnemonic === "STA" && ins.operand === FRAME)
        add({ what: cpu.regs.a === null ? "changes the frame shown" : `shows frame ${cpu.regs.a & 0xff}` });
    },
  };
  return walk(rom, objectEntry(rom, type), body);
}
