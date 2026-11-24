/**
 * The dash as Burst Limit asks for it: forward or back tapped twice and held.
 * It stands in for the dash button (LB) — pressed on the second tap, held
 * while the direction is — so the dash's own states need no second way in.
 *
 * It replaced the original's hop on the same gesture (owner, 2026-11-24): one
 * gesture cannot start two moves. Pure: no PixiJS, no DOM.
 */

import { PAD, type PadHistory } from "./command";

/**
 * Frames back in which the first tap must fall: the cartridge's own window
 * for a command's directions (`$6002`, `command.ts`), which the hop used too.
 */
const WINDOW = 12;

export class DoubleTap {
  /** The direction a dash was tapped in while it stays held, else 0. */
  private way = 0;

  /**
   * Read this frame of the pad, already recorded: whether the dash button
   * should count as pressed now, and as held.
   */
  step(history: PadHistory): { pressed: boolean; held: boolean } {
    const now = history.at(0).held;
    if (this.way && !(now & this.way)) this.way = 0;
    for (const way of [PAD.fwd, PAD.back]) {
      if (!tapped(history, 0, way)) continue;
      for (let back = 1; back <= WINDOW; back++) {
        if (tapped(history, back, way)) {
          this.way = way;
          return { pressed: true, held: true };
        }
      }
    }
    return { pressed: false, held: this.way !== 0 };
  }
}

/** A tap is the direction going down: held on that frame and not on the one before. */
function tapped(history: PadHistory, back: number, way: number): boolean {
  return (history.at(back).held & way) !== 0 && (history.at(back + 1).held & way) === 0;
}
