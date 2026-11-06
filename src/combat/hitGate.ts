/**
 * Who a blow cannot touch by what he is doing ($2A:8B92), apart from a state's own
 * `invulnerable`: the thrown-up reel `1e` is out of reach from its third step, and
 * within 16 px of the floor. So Tri Eruption's four objects of one set strike once.
 */

const HIGH_REEL = 0x1e;
/** Sprite px over the floor: `y` of 0xB8 or more against a floor of 0xC8. */
const OVER_FLOOR = 16;

/** `part` is his animation's 1-based part: `m1e_3` is 3, as the move's step is one past it. */
export function outOfReach(move: number | null, part: number, overFloor: number): boolean {
  return move === HIGH_REEL && (part >= 3 || overFloor <= OVER_FLOOR);
}
