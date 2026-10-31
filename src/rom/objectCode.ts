import { toFile } from "./cartridge";
import type { HandlerFact } from "./handler";
import type { Routine } from "./routines";
import { walk, type Body } from "./walk";

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
};

/** The code type `type` runs, before any jump by animation. */
export function objectEntry(rom: Uint8Array, type: number): number {
  const at = toFile(TYPES + 2 * type);
  if (at === null) throw new Error("the type table is not ROM");
  return (TYPES & 0xff0000) | rom[at] | (rom[at + 1] << 8);
}

export function objectFacts(rom: Uint8Array, type: number, anim: number): HandlerFact[] {
  const body: Body = {
    frames: TIMER,
    dispatch: { field: 0x01, entries: [anim], tagged: false },
    names: OBJECT_FIELDS,
    routines: ROUTINES,
    ownBanks: new Set([0x0f]),
    // the slot loop's next slot: the object's code has run
    stops: new Set([0x0fb47d]),
    observe(ins, cpu, add) {
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
