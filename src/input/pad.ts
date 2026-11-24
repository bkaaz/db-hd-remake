/**
 * A gamepad, turned into one game frame of input — the keyboard's twin
 * (`keyboard.ts`), and like it the only one who calls `frame`.
 *
 * The browser gives no events for a pad, only its state when asked, so the
 * edges are this file's: a button went down if it is down now and was not at
 * the last frame. A press shorter than a frame is lost, which a keyboard's
 * events do not lose; at 60 frames a second no thumb is that quick.
 *
 * Every connected pad plays player one: there is no second player yet.
 */

import type { WorldInput } from "../entity/entity";
import { ACTIONS, DIRECTIONS, PAD_BUTTONS, type Action, type Direction } from "./layout";

/** The part of the browser's `Gamepad` this reads, so a test can hand it one. */
export interface PadState {
  buttons: readonly { pressed: boolean }[];
  axes: readonly number[];
}

/**
 * How far the stick leans before it counts as the d-pad. Half way: a stick
 * pushed to a diagonal reads about 0.7 on each axis, and that has to be both.
 */
const LEAN = 0.5;

/** What is down on these pads, by the layout. */
export function readPads(pads: readonly (PadState | null)[]): Set<Action | Direction> {
  const down = new Set<Action | Direction>();
  for (const pad of pads) {
    if (!pad) continue;
    pad.buttons.forEach((button, i) => {
      const does = PAD_BUTTONS[i];
      if (button.pressed && does) down.add(does);
    });
    const [x = 0, y = 0] = pad.axes;
    if (x <= -LEAN) down.add("left");
    if (x >= LEAN) down.add("right");
    if (y <= -LEAN) down.add("up");
    if (y >= LEAN) down.add("down");
  }
  return down;
}

export class Pad {
  private was = new Set<Action | Direction>();

  constructor(private readonly read: () => readonly (PadState | null)[] = () => navigator.getGamepads?.() ?? []) {}

  /** Take one game frame of input; taking it is what makes the next frame's edges. */
  frame(): WorldInput {
    const down = readPads(this.read());
    const input = {} as WorldInput;
    for (const d of DIRECTIONS) input[d] = down.has(d);
    input.holding = {} as WorldInput["holding"];
    for (const a of ACTIONS) {
      input[a] = down.has(a) && !this.was.has(a);
      input.holding[a] = down.has(a);
    }
    this.was = down;
    return input;
  }
}
