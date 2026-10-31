import { blowStarts } from "./animation";
import { scriptAt, type FighterTables } from "./cartridge";
import { readBoxes } from "./collision";
import { groundReaction, hitRecords, recordAt } from "./hits";
import { readScript } from "./script";

/**
 * The blow an exported animation lands, from the fighter's own records:
 * `mNN` is move NN's first blow, `mNN_k` its k-th (`animation.ts`). The type
 * is named after the record's reaction. Null where the move has no record
 * for that blow.
 */
export function blowOfAnim(rom: Uint8Array, t: FighterTables, anim: string): { type: string; damage: number } | null {
  const [, id, part] = /^m([0-9a-f]{2})(?:_(\d+))?$/.exec(anim) ?? [];
  if (!id) return null;
  const move = parseInt(id, 16);
  const starts = blowStarts(readScript(rom, scriptAt(rom, t, move)), (d) => readBoxes(rom, t.boxes, d));
  const step = starts[(part ? Number(part) : 1) - 1];
  const record = step === undefined ? undefined : recordAt(hitRecords(rom, t.character, move), step);
  return record ? { type: groundReaction(record), damage: record.damage } : null;
}
