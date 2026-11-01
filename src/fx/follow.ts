/**
 * An effect that rides on whoever put it out — normal Goku's hair over
 * Saiyan Meteor's ae ($0F:B8F2), idle's lightning ($0F:B862): on his
 * position and facing every frame, and gone once he leaves the animation
 * that put it out. Pure, so the rule is tested; `Effects` applies it.
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

/** How a follower rides: by its owner's pose, or on his body with its own animation. */
export type FollowBy = "pose" | "body";

/**
 * What a follower shows this frame: a frame id, `"own"` for its own
 * animation, or null — it is gone. `play` is the owner's animation it was
 * put out in, counted, so the same animation started again ends it too: the
 * original kills it with the move ($0F:B87C), and a new one comes with the new
 * start.
 */
export function riding(by: FollowBy, play: number, owner: { play: number; drawing: string | undefined }): string | "own" | null {
  if (owner.play !== play) return null;
  return by === "pose" ? followedFrame(owner.drawing) : "own";
}
