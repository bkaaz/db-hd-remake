/**
 * A move's script as one of our animations: its steps become frames held for
 * as long, and everything else is left out until we read what it does.
 *
 * Named `m` + the move id in hex (ADR 0017) — the one name the game, the
 * disassembler and the recordings all share.
 */

import type { Anim, Step } from "../entity/entityFile";
import type { ScriptOp } from "./script";

export function animName(move: number): string {
  return "m" + move.toString(16).padStart(2, "0");
}

/**
 * Null when the script shows no drawing at all.
 *
 * A step that keeps "whichever drawing is up" has nothing to keep in an
 * animation of its own: in the middle it repeats the step before, and at the
 * start — the frames between the press and the move's first pose — it shows
 * that first pose, so the frame count, which is the original's timing, stays.
 * A script never says whether it loops (the engine restarts every script;
 * the move's code decides when it is over), so none of these loop.
 */
export function toAnim(ops: ScriptOp[]): Anim | null {
  const shown = ops.filter((op): op is Extract<ScriptOp, { op: "show" | "hold" }> => op.op === "show" || op.op === "hold");
  const first = shown.find((op) => op.drawing !== null)?.drawing;
  if (first === undefined || first === null) return null;

  const steps: Step[] = [];
  let current = first;
  for (const op of shown) {
    if (op.drawing !== null) current = op.drawing;
    // a hold lasts until something outside the script ends it: one frame here
    const dur = op.op === "hold" ? 1 : op.frames;
    if (dur > 0) steps.push({ frame: String(current), dur });
  }
  return { loop: false, steps };
}
