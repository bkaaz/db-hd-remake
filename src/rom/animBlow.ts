import type { FighterTables } from "./cartridge";
import { groundReaction, hitRecords, recordAt } from "./hits";
import { moveParts } from "./parts";

/**
 * The blow an exported animation lands, from the fighter's own records: the
 * record of the first step a hit box is out on in that part (`parts.ts`) —
 * which is the move's next blow, or the same blow re-armed. The type is named
 * after the record's reaction. Null where the part strikes nothing or the
 * move has no record for it.
 */
export function blowOfAnim(rom: Uint8Array, t: FighterTables, anim: string): { type: string; damage: number } | null {
  const [, id] = /^m([0-9a-f]{2})(?:_\d+)?$/.exec(anim) ?? [];
  if (!id) return null;
  const move = parseInt(id, 16);
  const part = moveParts(rom, t, move).parts.find((p) => p.anim === anim);
  const record = part?.blowStep == null ? undefined : recordAt(hitRecords(rom, t.character, move), part.blowStep);
  return record ? { type: groundReaction(record), damage: record.damage } : null;
}
