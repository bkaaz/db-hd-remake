import { toFile } from "./cartridge";
import { decode, ends, target, type Instruction, type Widths } from "./disasm";

/**
 * A move's handler — the code `$0F:8000` runs every frame of the move — and
 * what can be read off it without running it: at which frame it sets which
 * speed, and which known routines it calls when. docs/rom.md, Where to start
 * a search, says how handlers are laid out.
 *
 * Read by following its branches, remembering the frame each `CMP #n` on
 * field 0x44 led to. A handler written another way reads as fewer facts, never
 * as wrong ones; the address is in the report for reading the rest by hand.
 */

/** `$0F:8061`: a 2-byte pointer per fighter to 3-byte handler pointers by move. */
const HANDLERS = 0x0f8061;

export function handlerAt(rom: Uint8Array, character: number, move: number): number {
  const file = (address: number) => {
    const at = toFile(address);
    if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
    return at;
  };
  const table = file((HANDLERS & 0xff0000) | (rom[file(HANDLERS) + 2 * character] | (rom[file(HANDLERS) + 2 * character + 1] << 8)));
  const at = table + 3 * move;
  return rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16);
}

/** Routines a handler calls whose meaning is known. */
const KNOWN: Record<number, string> = {
  0x0dd8a2: "re-arms the blow",
  0x0f9fa3: "ends the move",
  0x0dd7a0: "stops",
};

export interface HandlerFact {
  /** The frame of the move (field 0x44) the code was reached on; null when no comparison led there. */
  frame: number | null;
  what: string;
  /** A speed set, px per frame, facing right. */
  vx?: number;
  /** A sound played, as the cartridge's id. */
  sound?: number;
}

/** `$0D:D82E`: plays the sound id in A (docs/rom.md). */
const PLAY_SOUND = 0x0dd82e;

/** Banks holding move handlers and their helpers, not the engine. */
const OWN_BANKS = new Set([0x0f, 0x10, 0x20]);

const FRAMES = 0x44;
const VX = 0x7c;

export function handlerFacts(rom: Uint8Array, entry: number): HandlerFact[] {
  const read = (address: number) => {
    const at = toFile(address);
    if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
    return rom[at];
  };
  const facts: HandlerFact[] = [];
  const seen = new Set<string>();
  // entered from $0F:8000 with an 8-bit accumulator and 16-bit index registers
  const queue: { at: number; w: Widths; frame: number | null }[] = [{ at: entry, w: { m8: true, x8: false }, frame: null }];
  while (queue.length > 0 && seen.size < 2000) {
    let { at, w, frame } = queue.shift()!;
    let prev: Instruction | null = null;
    let readsFrames = false;
    let compared: number | null = null;
    for (;;) {
      const key = `${at}:${frame}`;
      if (seen.has(key)) break;
      seen.add(key);
      const ins = decode(read, at, w);
      if (ins.mnemonic === "LDA") {
        readsFrames = ins.mode === "dx" && ins.operand === FRAMES;
        // a BEQ straight after the load asks whether the frame is 0
        if (readsFrames) compared = 0;
      }
      if (ins.mnemonic === "CMP" && ins.mode === "im" && readsFrames) compared = ins.operand;
      if (ins.mnemonic === "STA" && ins.mode === "dx" && ins.operand === VX && prev?.mnemonic === "LDA" && prev.mode === "im") {
        const v = (prev.operand << 16) >> 16;
        // the facing-left copy is the same speed negated
        if (v >= 0) facts.push({ frame, what: "sets vx", vx: v / 256 });
      }
      if (ins.mnemonic === "JSL" && KNOWN[ins.operand] !== undefined) facts.push({ frame, what: KNOWN[ins.operand] });
      if (ins.mnemonic === "JSL" && ins.operand === PLAY_SOUND && prev?.mnemonic === "LDA" && prev.mode === "im") {
        facts.push({ frame, what: "plays sound", sound: prev.operand & 0xff });
      }
      const to = target(ins);
      const call = ins.mnemonic === "JSL" || ins.mnemonic === "JSR";
      if (to !== null && !call) {
        // equal to the frame compared: the branch is the code for that frame
        queue.push({ at: to, w: ins.after, frame: ins.mnemonic === "BEQ" && compared !== null ? compared : frame });
      }
      // a handler's own helpers do part of its work (the jump's landing sound);
      // the engine's routines it calls are what KNOWN names, not followed
      if (to !== null && call && KNOWN[to] === undefined && OWN_BANKS.has(to >> 16)) {
        queue.push({ at: to, w: ins.after, frame });
      }
      if (ends(ins)) break;
      prev = ins;
      w = ins.after;
      at = (at & 0xff0000) | ((at + ins.bytes.length) & 0xffff);
    }
  }
  return dedupe(facts).sort((a, b) => (a.frame ?? -1) - (b.frame ?? -1));
}

function dedupe(facts: HandlerFact[]): HandlerFact[] {
  const keys = new Set<string>();
  return facts.filter((f) => {
    const k = `${f.frame}:${f.what}:${f.vx}:${f.sound}`;
    if (keys.has(k)) return false;
    keys.add(k);
    return true;
  });
}
