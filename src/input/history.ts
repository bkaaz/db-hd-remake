import { MOTIONS, type Directions, type MotionName } from "./motion";

/**
 * The last few inputs, as one line, for the debug readout.
 *
 * **What the engine saw, never what the keyboard sent.** Directions are
 * facing-relative, so `→` means forward and stays forward after a cross-up —
 * which is the whole point, since that is what a trigger asks about and a raw
 * left/right display would hide the one bug worth catching. Motions are shown
 * where they complete, so "did my roll register at all" stops being a question
 * anyone has to reason about.
 *
 * **One entry per change, not per frame.** Sixty rows a second is noise; a row
 * when the stick moves or a button goes down is what a training mode shows and
 * what a person can read.
 *
 * The buffer is not repeated here — `DebugPanel` already prints it with the
 * frames each press has left.
 *
 * Pure: no PixiJS, no DOM. Scaffolding, like the panel that draws it.
 */

/** How many entries the line holds before the oldest falls off. */
export const HISTORY_ENTRIES = 12;

interface Entry {
  dir: string;
  buttons: string[];
  motions: string[];
}

export class InputHistory {
  private readonly entries: Entry[] = [];
  /** Neutral: the stick starts centred, so nothing is a change until it moves. */
  private last = "·";

  /**
   * One game frame.
   *
   * `pressed` is the buttons that went down *this* frame, not what the buffer
   * still holds: this line is about what you did, and how long it stayed usable
   * is the buffer's own readout.
   */
  record(at: Directions, pressed: readonly string[], motions: readonly MotionName[]): void {
    const dir = glyph(at);
    const moved = dir !== this.last;
    this.last = dir;
    if (!moved && pressed.length === 0) return;
    this.entries.push({ dir, buttons: [...pressed], motions: [...motions] });
    if (this.entries.length > HISTORY_ENTRIES) this.entries.shift();
  }

  /** Oldest first, newest last — the direction you read a line of text in. */
  get line(): string {
    return this.entries.map(format).join(" ");
  }
}

/** Every motion the runner knows, for the caller to filter to the complete ones. */
export const MOTION_NAMES = Object.keys(MOTIONS) as MotionName[];

const format = (e: Entry): string =>
  e.dir + e.buttons.join("") + e.motions.map((m) => `·${m}`).join("");

/**
 * The eight directions and neutral, as one character.
 *
 * Arrows rather than the genre's numpad notation: a person reading this
 * codebase to learn it should not need a second diagram to read its debug line.
 */
function glyph(at: Directions): string {
  if (at.up) return at.fwd ? "↗" : at.back ? "↖" : "↑";
  if (at.down) return at.fwd ? "↘" : at.back ? "↙" : "↓";
  return at.fwd ? "→" : at.back ? "←" : "·";
}
