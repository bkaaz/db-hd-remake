/**
 * The hop: a direction tapped and then held, which the cartridge reads from
 * the pad's history before it lets a walk begin (`$0D:FE5D`, called by the
 * directions at `$0D:FA2C` / `$0D:FAA5`) and answers with move `08`, or
 * `09` backward. Not a command of the fighter's table — every fighter has it,
 * and nothing in `commands.json` says so.
 *
 * Pure: no PixiJS, no DOM.
 */

import { PAD, type PadHistory } from "./command";

/** Frames the direction must have been held, this one aside: the entries `$6010` is read for. */
const HELD = 5;
/** Frames, from there back, in which both taps must fall: `$6002` as a fight starts (`command.ts`, NEAR). */
const WINDOW = 12;

/** Whether this frame's pad asks for a hop, and which way; null when it does not. */
export function hopAsked(history: PadHistory): "fwd" | "back" | null {
  const now = history.at(0).held;
  // forward and back together are neither (`padFrame`), so one at most
  const way = now & PAD.fwd ? PAD.fwd : now & PAD.back ? PAD.back : 0;
  if (!way) return null;
  for (let back = 1; back <= HELD; back++) if (!(history.at(back).held & way)) return null;
  // a tap is the direction going down: held on a frame and not on the one before
  let taps = 0;
  for (let back = HELD; back < HELD + WINDOW; back++) {
    if (history.at(back).held & way && !(history.at(back + 1).held & way)) taps++;
  }
  return taps >= 2 ? (way === PAD.fwd ? "fwd" : "back") : null;
}
