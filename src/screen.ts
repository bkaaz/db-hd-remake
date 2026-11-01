/**
 * What a move does to the arena's art behind the fighters — the original's
 * `$37` effects (docs/rom.md, The game's `$37`): BG palettes 2–7 faded to a
 * level in sixteenths a step a frame (`$0D:DF64`), or held white. Pure, so
 * the stepping is tested; `Stage` draws it.
 */

/** A move's ask: dim to 6/16 (`1c`), back up to 16/16 (`1f`), white (`24`), white off (`22`). */
export type ScreenCue = "dim" | "bright" | "white" | "restore";

/** Brightness in sixteenths, where it is heading, and whether it is held white. */
export interface Screen {
  level: number;
  target: number;
  white: boolean;
}

export const LIT: Screen = { level: 16, target: 16, white: false };

/** The level `1c` fades the art down to ($0E:875D). */
const DIM = 6;

export function cue(s: Screen, c: ScreenCue): Screen {
  if (c === "dim") return { ...s, target: DIM };
  if (c === "bright") return { ...s, target: 16 };
  return { ...s, white: c === "white" };
}

/** One frame: a sixteenth toward the target. */
export function tick(s: Screen): Screen {
  return { ...s, level: s.level + Math.sign(s.target - s.level) };
}
