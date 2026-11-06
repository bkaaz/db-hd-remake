import type { Entity } from "../entity/entity";
import { contact } from "../combat/hit";
import { moveOfAnim } from "./thrownIn";

/**
 * A move that waits for a blow: two hit boxes touching ($2A:8537) while the
 * striker's blow is armed turn it on him ($2A:8640). The list names what gets
 * through, by the striker's fighter ($2A:86D1) — X and his 3D move, which pass
 * a parry by. Beside `blow.ts` because it decides before any blow is landed.
 */
export function parries(parrier: Entity, striker: Entity): boolean {
  const parry = parrier.parry;
  if (!parry || striker.parry) return false;
  if (!striker.canHit || parrier.facing === striker.facing) return false;
  if (striker.attackReaction === undefined && striker.attackDamage === 0) return false;
  if (parry.except[striker.name]?.includes(moveOfAnim(striker.animation))) return false;
  return !!contact(
    { boxes: parrier.boxes("hit"), at: parrier.placement },
    { boxes: striker.boxes("hit"), at: striker.placement },
  );
}
