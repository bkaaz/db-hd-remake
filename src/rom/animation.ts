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

/**
 * A move's animations, cut where its script spawns an object mid-way: `m9b`
 * up to the ki blast, `m9b_2` from it on — because our states fire a spawn
 * when they are entered (ADR 0018). A spawn before anything is shown stays
 * with the first part; it fires on entry as it is. Each later part starts
 * where the one before left off: the drawing that is up, flipped and offset
 * as it was.
 *
 * Cut too where each blow after the first begins (`blowStarts`), so every
 * blow of a multi-hit move is a state of its own, with its own damage and
 * type (ADR 0023).
 */
export function moveAnims(move: number, ops: ScriptOp[], boxesOf?: (drawing: number) => Box[]): Record<string, Anim> {
  const cutAt = boxesOf ? blowStarts(ops, boxesOf).slice(1) : [];
  const parts: ScriptOp[][] = [[]];
  let shown = false;
  let step = 0;
  for (const op of ops) {
    const isStep = op.op === "show" || op.op === "hold";
    if ((op.op === "spawn" && shown) || (isStep && cutAt.includes(step))) parts.push(carried(parts.flat()));
    if (isStep) {
      shown = true;
      step++;
    }
    parts[parts.length - 1].push(op);
  }
  if (parts.length === 1) {
    const one = moveAnim(move, ops, boxesOf);
    return one ? { [animName(move)]: one } : {};
  }
  const out: Record<string, Anim> = {};
  parts.forEach((part, i) => {
    const anim = toAnim(part, boxesOf);
    if (anim) out[i === 0 ? animName(move) : `${animName(move)}_${i + 1}`] = anim;
  });
  return out;
}

/**
 * The steps where a blow begins: a step showing a hit box after one that did
 * not. Counted as the engine counts steps (field 0x46) — every show and hold,
 * from 0 — so a blow's step is what the hit table is keyed by (src/rom/hits.ts).
 */
export function blowStarts(ops: ScriptOp[], boxesOf: (drawing: number) => Box[]): number[] {
  const starts: number[] = [];
  let current: number | null = null;
  let striking = false;
  let step = 0;
  for (const op of ops) {
    if (op.op !== "show" && op.op !== "hold") continue;
    if (op.drawing !== null) current = op.drawing;
    const strikes = current !== null && boxesOf(current).some((b) => b.type === "hit");
    if (strikes && !striking) starts.push(step);
    striking = strikes;
    step++;
  }
  return starts;
}

/** What a later part inherits: the last drawing (as a zero-frame step), flip and offset. */
function carried(before: ScriptOp[]): ScriptOp[] {
  const last = <K extends ScriptOp["op"]>(kind: K) =>
    [...before].reverse().find((op): op is Extract<ScriptOp, { op: K }> => op.op === kind);
  const drawing = [...before].reverse().find((op) => (op.op === "show" || op.op === "hold") && op.drawing !== null);
  const out: ScriptOp[] = [];
  const flip = last("flip");
  const offset = last("offset");
  if (flip) out.push(flip);
  if (offset) out.push(offset);
  if (drawing && (drawing.op === "show" || drawing.op === "hold") && drawing.drawing !== null)
    out.push({ op: "show", frames: 0, drawing: drawing.drawing });
  return out;
}
