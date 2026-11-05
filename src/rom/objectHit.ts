/**
 * What an object does when its blow lands (`$2A:8E31`): by its type at `$2A:8E4B`,
 * then its animation. Either the slot is killed and rewritten as another object,
 * an explosion where the boxes met, or it stays and plays on, its blow disarmed,
 * and `$2A:9A0B` leaves a melee blow's spark beside it. Never assume the
 * explosion: a standing object's normal blows are the second kind.
 */

import { toFile } from "./cartridge";
import { decode, type Instruction } from "./disasm";

const BY_TYPE = 0x2a8e4b;
const BANK = 0x2a0000;
const LONGEST_HANDLER = 40;

/** `burns`: the handler calls `$2A:99CC`, which sets the defender burning. */
export type ObjectHit = { stays: true } | { stays: false; becomes: { type: number; anim: number }; burns: boolean };

const SETS_BURNING = 0x99cc;

function pointerAt(rom: Uint8Array, table: number, index: number): number {
  const at = toFile(table + 2 * index);
  if (at === null) throw new Error(`${table.toString(16)} is not ROM`);
  return BANK | rom[at] | (rom[at + 1] << 8);
}

/** The code from `address` to its `RTL`, in the widths a handler runs in. */
function handler(rom: Uint8Array, address: number): Instruction[] {
  const read = (a: number) => {
    const at = toFile(a);
    return at === null ? 0 : rom[at];
  };
  const code: Instruction[] = [];
  let widths = { m8: true, x8: false };
  for (let at = address; code.length < LONGEST_HANDLER; ) {
    const ins = decode(read, at, widths);
    code.push(ins);
    widths = ins.after;
    at += ins.bytes.length;
    if (ins.mnemonic === "RTL" || ins.mnemonic === "JMP") break;
  }
  return code;
}

export function objectHit(rom: Uint8Array, type: number, anim: number): ObjectHit {
  const byType = handler(rom, pointerAt(rom, BY_TYPE, type));
  // a type with one answer has no table by animation
  const table = byType.find((i) => i.mnemonic === "LDA" && i.operand >> 16 === 0x2a);
  const code = table ? handler(rom, pointerAt(rom, table.operand & 0xffffff, anim)) : byType;
  // `LDA #$028A / STA $0000,Y`: the slot's first two bytes, type (bit 7: alive) and animation
  const written = code.findIndex((i, n) => i.mnemonic === "LDA" && i.mode === "im" && code[n + 1]?.mnemonic === "STA" && code[n + 1].operand === 0);
  if (written < 0) return { stays: true };
  const word = code[written].operand;
  const burns = code.some((i) => i.mnemonic === "JSR" && (i.operand & 0xffff) === SETS_BURNING);
  return { stays: false, becomes: { type: word & 0x0f, anim: word >> 8 }, burns };
}

/** The explosions a landed object is rewritten as, by name: `GOKU.objects`, type `a`. */
/** The largest explosion alone asks for the white screen, on its first frame (`$0F:E234`: `$37` = `16`). */
const WHITENS = 0x18;
const WHITE_FRAMES = 16;

const BURSTS: Record<number, string> = { 0x01: "burst", 0x02: "burst_s", 0x17: "burst_m", 0x18: "burst_l" };

/** What `hit` looks and sounds like in a spawn's states file: its blow's fields, and the sparks an object that stays leaves. */
export function hitFields(hit: ObjectHit): { file: { hitFx?: string; guardFx?: string }; state: Record<string, unknown> } {
  if (hit.stays) {
    return { file: { hitFx: "hit_spark", guardFx: "guard_spark" }, state: { hitSound: "hit_09", blockSound: "block_17", outlivesHit: true } };
  }
  const burst = hit.becomes.type === 0xa ? BURSTS[hit.becomes.anim] : undefined;
  if (!burst) throw new Error(`no spawn for object ${hit.becomes.type.toString(16)}/${hit.becomes.anim.toString(16)}`);
  return { file: {}, state: { burstsInto: burst, hitSound: "burst_0a", blockSound: "burst_0a", ...(hit.burns && { burns: true }), ...(hit.becomes.anim === WHITENS && { hitFlash: WHITE_FRAMES }) } };
}

