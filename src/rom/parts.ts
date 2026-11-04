import type { Anim } from "../entity/entityFile";
import { jumpCuts, jumpFrameCuts, moveAnims, rearmCuts, stepStarts } from "./animation";
import { scriptAt, type FighterTables } from "./cartridge";
import { readBoxes } from "./collision";
import { CROUCH, crouchAfterAttack } from "./crouch";
import { fallAfterJumpAttack, fallStep, JUMP } from "./fall";
import { handlerAt, handlerFacts, type HandlerFact } from "./handler";
import { readCommands } from "./commands";
import { readScript, spawnsFired, type ScriptOp } from "./script";

/**
 * A move cut into the parts our states play, and the step whose hit record
 * each part's blow takes. One answer for the export, the port report and the
 * check of a state's blow (`animBlow.ts`): each used to cut on its own, and
 * a part cut where a blow is re-armed is not the move's next blow.
 */

export interface MovePart {
  anim: string;
  /** The move's frame the part begins on. */
  from: number;
  frames: number;
  /** The first step a hit box is out on in this part — what its record is keyed by; null with none. */
  blowStep: number | null;
}

export interface MoveParts {
  ops: ScriptOp[];
  facts: HandlerFact[];
  anims: Record<string, Anim>;
  parts: MovePart[];
}

export function moveParts(rom: Uint8Array, t: FighterTables, move: number): MoveParts {
  const ops = readScript(rom, scriptAt(rom, t, move));
  const boxesOf = (d: number) => readBoxes(rom, t.boxes, d);
  const facts = factsOf(rom, t, move, ops);
  const rearms = facts.filter((f) => f.what === "re-arms the blow" && f.frame !== null).map((f) => f.frame!);
  const byHand = [
    ...(HAND_CUTS[move] ?? []),
    ...(DASHES.includes(move) ? dashCuts(ops, facts) : []),
    ...(move === JUMP ? [fallStep(ops, fallAfterJumpAttack(rom, t.character))] : []),
  ];
  const steps = [...new Set([...jumpCuts(ops, byStep(ops, facts)), ...stepLoopCuts(ops, facts), ...byHand])];
  const frames = [
    ...jumpFrameCuts(ops, facts),
    ...rearmCuts(ops, rearms, boxesOf),
    // another move's handler starts this one part-way
    ...(move === CROUCH ? [crouchAfterAttack(rom, t.character)] : []),
  ];
  // the opponent put in the hold, move 30, is untouchable (its script sets
  // field 0x96 to 70): a blow cannot land and cuts nothing, and the spawns go
  // on their steps — Saiyan Meteor's ae
  // or its command does (the row's byte 6): Vegeta's throw, whose handler only holds him there
  const holds =
    facts.some((f) => f.who === "opponent" && f.move === HOLD) ||
    readCommands(rom, t.character).some((c) => c.move === move && c.opponentMove !== null);
  const named = (type: number, anim: number) => t.objects.spawns.find((s) => s.type === type && s.anim === anim);
  const uncut = holds ? (type: number, anim: number) => named(type, anim)?.name : undefined;
  const onStep = (type: number, anim: number) => (named(type, anim)?.onStep?.includes(move) ? named(type, anim)?.name : undefined);
  // a handler that sets the counter picks by it; left alone, the spawns count themselves off
  const picks = facts.some((f) => f.counter !== undefined);
  const anims = moveAnims(move, holds && !picks ? spawnsFired(ops) : ops, boxesOf, steps, frames, uncut, onStep);

  const striking = strikingSteps(ops, boxesOf);
  const starts = stepStarts(ops);
  const parts: MovePart[] = [];
  let from = 0;
  for (const [anim, { steps: shown }] of Object.entries(anims)) {
    const length = shown.reduce((n, s) => n + (s.dur ?? 0), 0);
    const ends = (step: number) => starts[step + 1] ?? Infinity;
    const blowStep = striking.find((step) => starts[step] < from + length && ends(step) > from) ?? null;
    parts.push({ anim, from, frames: length, blowStep });
    from += length;
  }
  return { ops, facts, anims, parts };
}

/** The handler's facts, or none when it cannot be read. */
function factsOf(rom: Uint8Array, t: FighterTables, move: number, ops: ScriptOp[]): HandlerFact[] {
  try {
    return handlerFacts(rom, handlerAt(rom, t.character, move), stepStarts(ops).length, t.character);
  } catch {
    return [];
  }
}

/** Every step a hit box is out on, counted as the engine counts steps. */
function strikingSteps(ops: ScriptOp[], boxesOf: (drawing: number) => { type: string }[]): number[] {
  const out: number[] = [];
  let drawing: number | null = null;
  let step = 0;
  for (const op of ops) {
    if (op.op !== "show" && op.op !== "hold") continue;
    if (op.drawing !== null) drawing = op.drawing;
    if (drawing !== null && boxesOf(drawing).some((b) => b.type === "hit")) out.push(step);
    step++;
  }
  return out;
}

/** A handler's test of the script's second step count (field 0x47) against a step. */
const STEP_TEST = /^when field 47 \(.*\) is ([0-9a-f]{2})$/;

/**
 * A loop the handler keeps by step: on entering step N (field 0x47, "is N")
 * it sends the script back to a frame — charging's, Goku's step 4 to frame 6,
 * Vegeta's step 5 to 19 (`$20:81C2`, `$20:91B6`). Cut at both ends, so a
 * state can repeat it.
 */
function stepLoopCuts(ops: ScriptOp[], facts: HandlerFact[]): number[] {
  const starts = stepStarts(ops);
  return facts.flatMap((f) => {
    const test = f.when?.map((w) => STEP_TEST.exec(w)).find((m) => m);
    if (!test || f.to === undefined) return [];
    return [starts.filter((start) => start <= f.to!).length - 1, parseInt(test[1], 16)];
  });
}

/**
 * A jump a handler makes on a frame, or from one on, as made from the step
 * that frame is in — Vertical Ki's landing goes on at frame 56, a step of its
 * own ($20:A05C); Vegeta's crouch loops back to 8 from 43 ($20:9139).
 */
function byStep(ops: ScriptOp[], facts: HandlerFact[]): { step?: number; to?: number }[] {
  const starts = stepStarts(ops);
  return ownJumps(facts).map((f) =>
    f.step === undefined && (f.frame ?? f.from) !== undefined && f.frame !== undefined && f.to !== undefined
      ? { step: starts.filter((start) => start <= (f.frame ?? f.from)!).length - 1, to: f.to }
      : f,
  );
}

/** Without a jump made after setting another move: its frame is that move's (Gohan's `a9` into `1a` at 21, `$20:A994`). */
export function ownJumps(facts: HandlerFact[]): HandlerFact[] {
  const place = (f: HandlerFact) => [f.frame, f.step, ...(f.when ?? [])].join("|");
  const left = new Set<string>();
  return facts.filter((f) => {
    if (f.move !== undefined && f.who !== "opponent") left.add(place(f));
    return f.to === undefined || !left.has(place(f));
  });
}

/**
 * Cuts read by hand from handlers `handler.ts` does not follow yet. Pinned (`4a`, `$0F:A4B7`): it holds frame 3 until it lands,
 * then goes on from 23 — cut at step 1, a frame later — and holds 28 until it
 * lands again, then 32: step 3. One part a fall, as the states take them.
 * Galactic Gunfire's `af` holds step 1 until pinned frees it (`f0`, ADR
 * 0057) and goes on into step 2: cut there, so the state freed plays it.
 */
const HAND_CUTS: Record<number, number[]> = { 0x4a: [1, 3], 0xaf: [2] };
/** The dash, forward and back. */
const DASHES = [0x0a, 0x0b];

/**
 * Where a dash's handler sends it, whatever step it is on: back to the start
 * of its run while it is held, and let go to its way out (`$20:8004`, 8 and
 * 16; Gohan's `$20:B68B`, whose run is three steps long, 6 and 18).
 */
function dashCuts(ops: ScriptOp[], facts: HandlerFact[]): number[] {
  const starts = stepStarts(ops);
  return facts.flatMap((f) => (f.frame === null && f.to !== undefined && starts.includes(f.to) ? [starts.indexOf(f.to)] : []));
}
/** Move 30: the original's hold, where a throw keeps the opponent. */
const HOLD = 0x30;
