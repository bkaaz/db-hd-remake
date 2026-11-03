/**
 * An effect that rides on whoever put it out — normal Goku's hair over
 * Saiyan Meteor's ae ($0F:B8F2), idle's lightning ($0F:B862), his hair in
 * his winning pose ($0F:B8CD): on his position and facing every frame, and
 * gone once he leaves what put it out. Pure, so the rule is tested; `Effects`
 * applies it.
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

/**
 * How a follower rides: by its owner's pose, on his body with its own
 * animation, or by the step of his move's script — the frame his step less
 * `step`, for as long as he is in the move, whatever part of it plays.
 */
export type FollowBy = "pose" | "body" | { step: number };

/** What a follower reads of its owner each frame. */
export interface Owner {
  /** Which start of an animation this is. */
  play: number;
  drawing: string | undefined;
  /** His move, read off the animation's name; null for one of ours. */
  move: number | null;
  /** His step in the move's whole script (`moveStep`). */
  step: number;
}

/**
 * What a follower shows this frame: a frame id, `"own"` for its own
 * animation, or null — it is gone. `since` is what the owner was playing as
 * it went out: the animation's start, counted, so the same animation started
 * again ends it too — the original kills it with the move ($0F:B87C), and a
 * new one comes with the new start; and the move, which one riding by step
 * outlives its parts in ($0F:B8D9).
 */
export function riding(by: FollowBy, since: { play: number; move: number | null }, owner: Owner): string | "own" | null {
  if (typeof by === "object") {
    const frame = owner.step - by.step;
    return owner.move !== null && owner.move === since.move && frame >= 0 ? String(frame) : null;
  }
  if (owner.play !== since.play) return null;
  return by === "pose" ? followedFrame(owner.drawing) : "own";
}

/**
 * Which step of its move's whole script a part's step is: the steps of the
 * parts before it (`m3e`, then `m3e_2` …) and its own. `steps` counts a
 * part's; a part it does not know counts none.
 */
export function moveStep(anim: string, step: number, steps: (anim: string) => number | undefined): number {
  const m = /^(m[0-9a-f]{2})(?:_(\d+))?$/.exec(anim);
  if (!m) return step;
  const part = Number(m[2] ?? 1);
  let before = 0;
  for (let n = 1; n < part; n++) before += steps(n === 1 ? m[1] : `${m[1]}_${n}`) ?? 0;
  return before + step;
}
