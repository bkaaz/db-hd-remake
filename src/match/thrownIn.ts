/**
 * What keeps a bolt alive that its thrower's move holds up (`endsWithMove`):
 * the original tests his move, not a part of it — Energy Field while he is in
 * `ab` or `d2` ($0F:BB51), Final Flash's head through `ac` and `b5`
 * ($0F:BE66) — so a move cut into parts, or followed by its hold, keeps it.
 */

/** The move an exported animation plays, `mac_2` → `ac`; any other animation is its own name. */
export function moveOfAnim(anim: string): string {
  return /^m([0-9a-f]{2})(?:_\d+)?$/.exec(anim)?.[1] ?? anim;
}

/** The moves the bolt lives through: those named, or the one its thrower was playing as it went out. */
export function movesHeld(endsWithMove: true | readonly string[], throwerAnim: string): readonly string[] {
  return endsWithMove === true ? [moveOfAnim(throwerAnim)] : endsWithMove;
}

/** Whether the thrower has left every move the bolt lives through. */
export function leftMove(moves: readonly string[], throwerAnim: string): boolean {
  return !moves.includes(moveOfAnim(throwerAnim));
}
