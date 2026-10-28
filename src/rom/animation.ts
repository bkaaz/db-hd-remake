/**
 * A move's script as one of our animations: its steps become frames held for
 * as long, and everything else is left out until we read what it does.
 *
 * Named `m` + the move id in hex (ADR 0017) — the one name the game, the
 * disassembler and the recordings all share.
 */

import type { Anim, Box, Step } from "../entity/entityFile";
import { PLAIN, frameId, placeBoxes, type Look } from "./look";
import type { ScriptOp } from "./script";

/**
 * The engine restarts every script that reaches its 00, and a move's own code
 * decides when the move is over — so a script cannot say whether it repeats.
 * A script that *freezes* says so itself (a hold step, as crouching does) and
 * needs nothing here. These two lists are what only the move code knows, read
 * off the recordings (docs/rom.md):
 *
 * - **repeats** until the input changes: idle, walking, guarding, being dizzy;
 * - **holds one step** while the input is held: the dash keeps its middle
 *   pose. Its recovery step, played after the release, is left out for now.
 */
const REPEATS = new Set([0x00, 0x01, 0x02, 0x0e, 0x10, 0x12, ...range(0x26, 0x3a)]);
const HOLDS_STEP: Record<number, number> = { 0x0a: 1, 0x0b: 1 };

export function loops(move: number): boolean {
  return REPEATS.has(move);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

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
 * Whether it loops is not the script's to say — see `loops`.
 *
 * A flip or an offset lasts from where the script sets it until it is set
 * again, and both start cleared, as the engine clears them when a move starts.
 * A step shown flipped or offset names a frame of its own (src/rom/look.ts),
 * and its boxes move with the drawing.
 */
export function toAnim(ops: ScriptOp[], boxesOf: (drawing: number) => Box[] = () => []): Anim | null {
  const first = ops.find((op) => (op.op === "show" || op.op === "hold") && op.drawing !== null);
  if (!first || (first.op !== "show" && first.op !== "hold") || first.drawing === null) return null;

  const steps: Step[] = [];
  let current = first.drawing;
  let look: Look = PLAIN;
  for (const op of ops) {
    if (op.op === "flip") look = { ...look, h: op.h, v: op.v };
    if (op.op === "offset") look = { ...look, dx: op.dx, dy: op.dy };
    if (op.op !== "show" && op.op !== "hold") continue;
    if (op.drawing !== null) current = op.drawing;
    // a hold lasts until something outside the script ends it: one frame here
    const dur = op.op === "hold" ? 1 : op.frames;
    if (dur === 0) continue;
    const frame = frameId(current, look);
    const boxes = placeBoxes(boxesOf(current), look);
    steps.push(boxes.length ? { frame, dur, boxes } : { frame, dur });
  }
  return { loop: false, steps };
}

/** The animation for a move id: its script's steps, repeating or held as the original does. */
export function moveAnim(move: number, ops: ScriptOp[], boxesOf?: (drawing: number) => Box[]): Anim | null {
  const anim = toAnim(ops, boxesOf);
  if (!anim) return null;
  const hold = HOLDS_STEP[move];
  if (hold !== undefined) return { loop: false, steps: anim.steps.slice(0, hold + 1) };
  return { ...anim, loop: loops(move) };
}
