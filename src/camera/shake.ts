/**
 * The original's screen shake ($E3, run by $0D:C558): the backdrop's
 * vertical scroll is offset by a table entry each frame, and the fighters
 * stay where they are — the original adds it to the background's scroll
 * and never to the camera the sprites are drawn from (`rom.md`, The camera).
 *
 * Pure: an offset in game px, read by whoever draws the backdrop.
 */

/** `$0D:C593`: four patterns, entry n played when n frames are left; entry 0 is never read. */
const PATTERNS = [
  [0, -1, 1, -2, 2, -1, 1, -2, 2, -1, 1, -2, 2, -1, 1, -1],
  [0, -2, 2, -3, 3, -2, 2, -4, 4, -2, 2, -3, 3, -2, 2, -2],
  [0, -2, 2, -4, 4, -2, 2, -4, 4, -2, 2, -4, 4, -2, 2, -2],
  [0, -2, 4, -6, 4, -2, 4, 0, 2, -4, 6, -4, 2, -4, 6, -4],
];

/**
 * A shake as the original writes it: `frames` is the count it sets, which
 * moves the picture on `frames − 1` of them — the knockdown's `8108` is
 * pattern 1 for 8, seen as −4 +2 −2 +3 −3 +2 −2.
 */
export interface ShakeDef {
  pattern: number;
  frames: number;
}

export const SHAKE_PATTERNS = PATTERNS.length;

export class Shake {
  private pattern = 0;
  private left = 0;
  /** How far the backdrop's scroll is pushed this frame; positive moves the picture up. */
  offset = 0;

  /** A new shake replaces one still running, as the original's single `$E3` does. */
  start({ pattern, frames }: ShakeDef): void {
    this.pattern = pattern;
    this.left = frames;
  }

  /** One game frame. */
  tick(): void {
    if (this.left > 0) this.left--;
    // The low 4 bits only, so a shake longer than 15 goes round the table again.
    this.offset = this.left > 0 ? PATTERNS[this.pattern][this.left & 15] : 0;
  }
}
