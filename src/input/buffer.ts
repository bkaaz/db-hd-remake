/**
 * Input buffer: a press stays available for a few frames after it happens.
 *
 * Without one, a button is only read on the exact frame it went down, and the
 * engine throws away everything else — including presses made during **hitstop**,
 * when a frozen entity returns before ever looking at its input. That is the
 * worst possible moment to lose one: the pause is precisely when a player,
 * having just seen the hit land, reaches for the next attack.
 *
 * The buffer is ticked by the entity that owns it, so a frozen fighter does not
 * age it either. The pause cannot eat a press by standing still.
 *
 * Pure: no PixiJS, no DOM, no clock of its own — frames are counted by whoever
 * calls `tick`.
 */

/** How long a press stays usable, in game frames. */
export const BUFFER_FRAMES = 8;

export class InputBuffer {
  /** Button name → frames of life left. Absent means "not pressed". */
  private readonly life = new Map<string, number>();

  constructor(private readonly window: number = BUFFER_FRAMES) {}

  /** Record a press. A second press simply refreshes the window. */
  press(button: string): void {
    this.life.set(button, this.window);
  }

  /** Is this press still available? */
  has(button: string): boolean {
    return (this.life.get(button) ?? 0) > 0;
  }

  /**
   * Spend a press, so one press cannot fire two moves. Called when a transition
   * actually fires on it — an unspent press just expires on its own.
   */
  consume(button: string): void {
    this.life.delete(button);
  }

  /** Age everything by one game frame. */
  tick(): void {
    for (const [button, left] of this.life) {
      if (left <= 1) this.life.delete(button);
      else this.life.set(button, left - 1);
    }
  }

  /** Frames of life left, for tests and debugging. */
  remaining(button: string): number {
    return this.life.get(button) ?? 0;
  }

  /** Every press still usable, newest window first — for the debug readout. */
  live(): [button: string, framesLeft: number][] {
    return [...this.life].sort((a, b) => b[1] - a[1]);
  }
}
