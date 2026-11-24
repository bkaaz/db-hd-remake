/**
 * Player one's hands: the keyboard and every pad, one frame of input from
 * both. What one of them pressed counts, so the two can be swapped mid-fight
 * — or, until a second player exists, both played at once.
 *
 * The debug keys stay the keyboard's (`keyboard`), as nothing on a pad asks
 * for them.
 */

import type { WorldInput } from "../entity/entity";
import type { Keyboard } from "./keyboard";
import { ACTIONS, DIRECTIONS } from "./layout";
import { Pad } from "./pad";

export class Controls {
  constructor(
    readonly keyboard: Keyboard,
    private readonly pad = new Pad(),
  ) {}

  /** Take one game frame of input — once a frame and by one caller, as each source's own `frame` asks. */
  frame(): WorldInput {
    const a = this.keyboard.frame();
    const b = this.pad.frame();
    const input = { ...a, holding: { ...a.holding } };
    for (const d of DIRECTIONS) input[d] ||= b[d];
    for (const x of ACTIONS) {
      input[x] ||= b[x];
      input.holding[x] ||= b.holding[x];
    }
    return input;
  }
}
