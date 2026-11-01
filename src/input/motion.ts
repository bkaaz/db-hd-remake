/**
 * Motion inputs: a **sequence** of directions, where `held:` asks about one frame.
 *
 * Every direction trigger the state machine has is a live condition — true only
 * while the key is down — so a command can only ever be "hold this, press that".
 * That is right for a command normal and wrong for a special: nobody holds
 * down-forward to throw a fireball, they roll through it. Rolling leaves nothing
 * behind for a live condition to see, which is why this keeps a short history of
 * what the stick did and matches sequences against it.
 *
 * Apart from `buffer.ts` because it answers a different question. The buffer
 * asks "was this button pressed recently" — one key, one clock. This asks "did
 * these directions happen, in this order, recently" — many frames, one shape.
 *
 * Pure: no PixiJS, no DOM, no clock of its own. Frames arrive by `push`.
 */

/** One frame of the stick, facing-relative — the four flags a trigger asks about. */
export interface Directions {
  fwd: boolean;
  back: boolean;
  up: boolean;
  down: boolean;
}

/**
 * How long a motion stays completed, in game frames.
 *
 * Short on purpose. The matcher is lenient about *what* you pass through (see
 * below), so the window is what stops a crouch, a stand-up and a walk forward
 * from reading as a quarter circle half a second later. Fourteen is a little
 * over the press buffer's twelve: the motion has to still be true on the frame
 * the buffered press is spent, never the other way round.
 */
export const MOTION_FRAMES = 14;

/**
 * The motions the runner understands, each as the directions it must pass
 * through, in order.
 *
 * **The diagonal is not required**, and that is the decision this table encodes:
 * `qcf` is down then forward, so ↓ ↘ → matches and so does ↓ →. Requiring ↘
 * makes a motion that "does not come out", which is the complaint this module
 * exists to answer. The cost is a false positive — crouch, stand, walk forward,
 * and inside the window that reads as a quarter circle — and the window is what
 * keeps it rare rather than the shape.
 */
export const MOTIONS = {
  qcf: ["down", "fwd"],
  qcb: ["down", "back"],
  /** The original's half circle, ← ↙ ↓ ↘ → (Quadruple Kick, the Kamehameha, the Big Bang). */
  hcf: ["back", "down", "fwd"],
  /** ↓ ↙ →, back through the bottom and out forward (the charged Kamehameha, Final Flash). */
  dbf: ["down", "back", "fwd"],
  /** → ↓ ↘, forward, down and out forward again (Jumping Knee Slash). */
  dp: ["fwd", "down", "fwd"],
  /** → ↓, forward then down (Slash Down Kick, in the air). */
  fd: ["fwd", "down"],
  /** ← ↓ ↙, back, down and out back again (the teleports) — a dp the other way. */
  rdp: ["back", "down", "back"],
} as const satisfies Record<string, readonly (keyof Directions)[]>;

export type MotionName = keyof typeof MOTIONS;

const NEUTRAL: Directions = { fwd: false, back: false, up: false, down: false };

export class Motions {
  /** Oldest first, capped at the window. */
  private readonly history: Directions[] = [];

  /**
   * One game frame of directions.
   *
   * Not called while the entity is frozen, for the same reason the buffer is not
   * ticked there: a hit pause must not age an input out of existence.
   */
  push(at: Directions): void {
    this.history.push(at);
    if (this.history.length > MOTION_FRAMES) this.history.shift();
  }

  /**
   * Has this motion been completed inside the window?
   *
   * A direction counts on the frame it is **pressed**, not on every frame it is
   * held: counting held frames read a ↙ held for two as back-then-down and as
   * down-then-back alike, so ↓ ← → came out as the half circle (Vegeta's Big
   * Bang in place of Final Flash). A diagonal pressed from neutral is both its
   * directions at once, and one held since before the window counts as pressed
   * at its start — so holding ↘ still completes a quarter circle.
   */
  has(name: MotionName): boolean {
    const want: readonly (keyof Directions)[] = MOTIONS[name];
    let step = 0;
    let before = NEUTRAL;
    for (const at of this.history) {
      while (step < want.length && at[want[step]] && !before[want[step]]) step++;
      if (step === want.length) return true;
      before = at;
    }
    return false;
  }
}
