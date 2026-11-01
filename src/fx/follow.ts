/**
 * An effect that rides on whoever put it out — normal Goku's hair over
 * Saiyan Meteor's ae ($0F:B8F2): on his position and facing every frame,
 * showing the frame his own drawing names, and gone once that names none or
 * he leaves the move. Pure, so the rule is tested; `Effects` applies it.
 */

/**
 * The frame to show for its owner's drawing (a frame id, the drawing's number):
 * the drawing's low three bits while below 3 — `a0`, `a1`, `a2` give 0, 1, 2 —
 * else null, and it is gone.
 */
export function followedFrame(drawing: string | undefined): string | null {
  const n = Number(drawing);
  if (drawing === undefined || !Number.isInteger(n)) return null;
  const low = n & 7;
  return low < 3 ? String(low) : null;
}
