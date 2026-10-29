import { toFile } from "./cartridge";

/**
 * A move's records in the cartridge's hit table, which the hit code at
 * $0D:D189 looks up at contact (docs/rom.md, Hit data). Read so that the
 * damage and hit types copied by hand into a fighter's states can be checked
 * against the cartridge — not exported: states stay hand-authored (ADR 0013).
 */
export interface HitRecord {
  /** The last step of the attacker's move this record covers; null for every step. */
  upToStep: number | null;
  /** Bytes 0–2 as one number: which reaction, read by the defender's situation. */
  reaction: number;
  /** Taken off health, before the defender's defence. */
  damage: number;
  /** Taken off the stun gauge. */
  stun: number;
}

/** $3D:8000 — a 2-byte pointer per fighter, each to one pointer per move from 0x90. */
const HIT_TABLES = 0x3d8000;
const FIRST_MOVE = 0x90;
const RECORD = 6;

export function hitRecords(rom: Uint8Array, character: number, move: number): HitRecord[] {
  if (move < FIRST_MOVE) return [];
  const word = (at: number) => rom[at] | (rom[at + 1] << 8);
  const inBank = (p: number) => {
    const off = toFile((HIT_TABLES & 0xff0000) | p);
    if (off === null) throw new Error(`hit table pointer ${p.toString(16)} is not ROM`);
    return off;
  };
  const moves = inBank(word(inBank(HIT_TABLES & 0xffff) + 2 * character));
  const records: HitRecord[] = [];
  for (let at = inBank(word(moves + 2 * (move - FIRST_MOVE))); ; at += RECORD) {
    const step = rom[at];
    records.push({
      upToStep: step === 0xff ? null : step,
      reaction: rom[at + 1] | (rom[at + 2] << 8) | (rom[at + 3] << 16),
      damage: rom[at + 4],
      stun: rom[at + 5],
    });
    if (step === 0xff) return records;
    if (records.length === 16) throw new Error(`move ${move.toString(16)}: hit records have no end`);
  }
}

/** `$3D:9624`: a 2-byte pointer per object type, to 2-byte pointers by animation. */
const OBJECT_HITS = 0x3d9624;

/**
 * What an object's blow does — a projectile's — read by `$0D:D1DA` from the
 * object's type and animation rather than a fighter's move: one record, the
 * same five bytes as a move's.
 */
export function objectRecord(rom: Uint8Array, type: number, anim: number): HitRecord {
  const word = (at: number) => rom[at] | (rom[at + 1] << 8);
  const inBank = (p: number) => {
    const off = toFile((OBJECT_HITS & 0xff0000) | p);
    if (off === null) throw new Error(`object hit pointer ${p.toString(16)} is not ROM`);
    return off;
  };
  const at = inBank(word(inBank(word(inBank(OBJECT_HITS & 0xffff) + 2 * type)) + 2 * anim));
  return {
    upToStep: null,
    reaction: rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16),
    damage: rom[at + 3],
    stun: rom[at + 4],
  };
}

/** The record a blow starting at `step` takes: the first that covers it. */
export function recordAt(records: readonly HitRecord[], step: number): HitRecord | undefined {
  return records.find((r) => r.upToStep === null || r.upToStep >= step);
}

/** The bits `$0D:D2C0` tests for a standing defender, in its order. */
const GROUND_ORDER = [0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x400, 0x800, 0x1000];

/** The hit types named after the original's reactions, by the bit that picks each. */
const REACTION_TYPES: Record<number, string> = { 0x08: "light", 0x10: "heavy", 0x40: "down" };

/**
 * How a standing defender takes the blow, as the hit type named after it: the
 * first of its bits the game tests. "other" for a reaction no type copies yet.
 */
export function groundReaction(r: HitRecord): string {
  const first = GROUND_ORDER.find((bit) => r.reaction & bit);
  return (first !== undefined && REACTION_TYPES[first]) || "other";
}
