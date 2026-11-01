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
/** A `b0`'s object as the spawn entity we export it as, or undefined for one we do not. */
export type SpawnName = (type: number, anim: number) => string | undefined;

export function toAnim(ops: ScriptOp[], boxesOf: (drawing: number) => Box[] = () => [], spawnName?: SpawnName): Anim | null {
  const first = ops.find((op) => (op.op === "show" || op.op === "hold") && op.drawing !== null);
  if (!first || (first.op !== "show" && first.op !== "hold") || first.drawing === null) return null;

  const steps: Step[] = [];
  let current = first.drawing;
  let look: Look = PLAIN;
  // an a0 plays as the engine walks past it, which is as the next step begins
  let sfx: number[] = [];
  let voice: number | undefined;
  let spawns: NonNullable<Step["spawns"]> = [];
  for (const op of ops) {
    const spawned = op.op === "spawn" ? spawnName?.(op.type, op.anim) : undefined;
    if (op.op === "spawn" && spawned) spawns.push({ name: spawned, at: [op.dx, op.dy] });
    if (op.op === "flip") look = { ...look, h: op.h, v: op.v };
    if (op.op === "offset") look = { ...look, dx: op.dx, dy: op.dy };
    if (op.op === "sound") sfx.push(op.id);
    if (op.op === "voice") voice = op.id;
    if (op.op !== "show" && op.op !== "hold") continue;
    if (op.drawing !== null) current = op.drawing;
    // a hold lasts until something outside the script ends it: one frame here
    const dur = op.op === "hold" ? 1 : op.frames;
    if (dur === 0) continue;
    const step: Step = { frame: frameId(current, look), dur };
    const boxes = placeBoxes(boxesOf(current), look);
    if (boxes.length) step.boxes = boxes;
    if (sfx.length) step.sfx = sfx;
    if (voice !== undefined) step.voice = voice;
    if (spawns.length) step.spawns = spawns;
    sfx = [];
    voice = undefined;
    spawns = [];
    steps.push(step);
  }
  return { loop: false, steps };
}

/** The animation for a move id: its script's steps, repeating or held as the original does. */
export function moveAnim(move: number, ops: ScriptOp[], boxesOf?: (drawing: number) => Box[], spawnName?: SpawnName): Anim | null {
  const anim = toAnim(ops, boxesOf, spawnName);
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
 * type (ADR 0023) — and at the steps in `cuts` (`jumpCuts`), and at the
 * move's frames in `frameCuts`: where another move's handler starts this one
 * part-way, inside a step as often as not (`crouch.ts`). A step a cut falls
 * inside is shown in pieces, its count of steps unchanged.
 */
export function moveAnims(
  move: number,
  ops: ScriptOp[],
  boxesOf?: (drawing: number) => Box[],
  cuts: number[] = [],
  frameCuts: number[] = [],
  uncut?: SpawnName,
): Record<string, Anim> {
  // `uncut`: a move whose blows cannot land and whose spawns no state fires —
  // one animation, its spawns named on their steps
  const cutAt = [...(boxesOf && !uncut ? blowStarts(ops, boxesOf).slice(1) : []), ...cuts];
  const parts: ScriptOp[][] = [[]];
  // a step shown since the last cut: several spawns at once are one cut
  let shown = false;
  let step = 0;
  let frame = 0;
  const cut = () => {
    shown = false;
    // sounds after the last step play as the next part begins, so they go
    // with it — the Kamehameha's shot has an effect command between its
    // sound and the cut, and was silent while only the sounds right before
    // the cut were moved
    const last = parts[parts.length - 1];
    let lastStep = last.length - 1;
    while (lastStep >= 0 && last[lastStep].op !== "show" && last[lastStep].op !== "hold") lastStep--;
    const tail = last.splice(lastStep + 1);
    const isSound = (o: ScriptOp) => o.op === "sound" || o.op === "voice";
    last.push(...tail.filter((o) => !isSound(o)));
    parts.push([...carried(parts.flat()), ...tail.filter(isSound)]);
  };
  for (const op of ops) {
    if (op.op !== "show" && op.op !== "hold") {
      if (op.op === "spawn" && shown && !uncut) cut();
      parts[parts.length - 1].push(op);
      continue;
    }
    if (cutAt.includes(step) || frameCuts.includes(frame)) cut();
    const [first, ...rest] = op.op === "show" ? piecesOf(op, frame, frameCuts) : [op];
    parts[parts.length - 1].push(first);
    for (const piece of rest) {
      cut();
      parts[parts.length - 1].push(piece);
    }
    shown = true;
    step++;
    frame += op.op === "hold" ? 1 : op.frames;
  }
  if (parts.length === 1) {
    const one = moveAnim(move, ops, boxesOf, uncut);
    return one ? { [animName(move)]: one } : {};
  }
  const out: Record<string, Anim> = {};
  parts.forEach((part, i) => {
    const anim = toAnim(part, boxesOf, uncut);
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

/** The move's frame each step of the script starts on, counted as the engine counts steps. */
export function stepStarts(ops: ScriptOp[]): number[] {
  const starts: number[] = [];
  let frame = 0;
  for (const op of ops) {
    if (op.op !== "show" && op.op !== "hold") continue;
    starts.push(frame);
    frame += op.op === "hold" ? 1 : op.frames;
  }
  return starts;
}

/**
 * The steps a handler jumps to from another step (`handlerFacts`' `to`, on a
 * `step`) — the knockdown's fall, its floor and its lying: what decides when
 * each comes is the handler, landing or turning to fall, so each is a part a
 * state can wait in. A jump inside the step it runs on holds a pose and cuts
 * nothing.
 */
export function jumpCuts(ops: ScriptOp[], jumps: { step?: number; to?: number }[]): number[] {
  const starts = stepStarts(ops);
  const cuts = new Set<number>();
  for (const { step, to } of jumps) {
    if (step === undefined || to === undefined) continue;
    const target = starts.indexOf(to);
    if (target > 0 && target !== step) cuts.add(target);
  }
  return [...cuts].sort((a, b) => a - b);
}

/**
 * The frames a handler jumps to from another step that fall inside a step
 * rather than at its start — Vegeta's knockdown lies from frame 100, thirty
 * frames into his lying step (`moveAnims`' `frameCuts`).
 */
export function jumpFrameCuts(ops: ScriptOp[], jumps: { step?: number; to?: number }[]): number[] {
  const starts = stepStarts(ops);
  const cuts = new Set<number>();
  for (const { step, to } of jumps) {
    if (step === undefined || to === undefined || starts.includes(to)) continue;
    const inside = starts.filter((start) => start < to).length - 1;
    if (inside >= 0 && inside !== step) cuts.add(to);
  }
  return [...cuts].sort((a, b) => a - b);
}

/**
 * The frames a handler re-arms the blow on (`$0D:D8A2`) while a hit box is
 * out: each begins a part, so the state that plays it brings a fresh swing —
 * Jumping Knee Slash hits up to three times, at 4, 10 and 16. A re-arm with
 * nothing out cuts nothing; the next blow's own start does.
 */
export function rearmCuts(ops: ScriptOp[], rearms: number[], boxesOf: (drawing: number) => Box[]): number[] {
  const striking = (frame: number) => {
    let at = 0;
    let drawing: number | null = null;
    for (const op of ops) {
      if (op.op !== "show" && op.op !== "hold") continue;
      if (op.drawing !== null) drawing = op.drawing;
      const end = at + (op.op === "hold" ? 1 : op.frames);
      if (frame >= at && frame < end) return drawing !== null && boxesOf(drawing).some((b) => b.type === "hit");
      at = end;
    }
    return false;
  };
  return rearms.filter((f) => f > 0 && striking(f)).sort((a, b) => a - b);
}

/** A shown step cut where a frame cut falls inside it: one piece per stretch. */
function piecesOf(op: Extract<ScriptOp, { op: "show" }>, start: number, frameCuts: number[]): ScriptOp[] {
  const inside = frameCuts.filter((f) => f > start && f < start + op.frames).sort((a, b) => a - b);
  const bounds = [start, ...inside, start + op.frames];
  return bounds.slice(1).map((end, i) => ({ ...op, frames: end - bounds[i] }));
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
