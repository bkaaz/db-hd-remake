import type { Anim } from "../entity/entityFile";
import { jumpCuts, jumpFrameCuts, moveAnims, rearmCuts, stepStarts } from "./animation";
import { scriptAt, type FighterTables } from "./cartridge";
import { readBoxes } from "./collision";
import { CROUCH, crouchAfterAttack } from "./crouch";
import { fallAfterJumpAttack, fallStep, JUMP } from "./fall";
import { handlerAt, handlerFacts, type HandlerFact } from "./handler";
import { readScript, type ScriptOp } from "./script";

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
  const byHand = [...(HAND_CUTS[move] ?? []), ...(move === JUMP ? [fallStep(ops, fallAfterJumpAttack(rom, t.character))] : [])];
  const steps = [...new Set([...jumpCuts(ops, facts), ...byHand])];
  const frames = [
    ...jumpFrameCuts(ops, facts),
    ...rearmCuts(ops, rearms, boxesOf),
    // another move's handler starts this one part-way
    ...(move === CROUCH ? [crouchAfterAttack(rom, t.character)] : []),
  ];
  // the opponent put in the hold, move 30, is untouchable (its script sets
  // field 0x96 to 70): a blow cannot land and cuts nothing, and the spawns go
  // on their steps — Saiyan Meteor's ae
  const holds = facts.some((f) => f.who === "opponent" && f.move === HOLD);
  const uncut = holds ? (type: number, anim: number) => t.objects.spawns.find((s) => s.type === type && s.anim === anim)?.name : undefined;
  const anims = moveAnims(move, ops, boxesOf, steps, frames, uncut);

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

/**
 * Cuts read by hand from handlers `handler.ts` does not follow yet. Charging
 * (`0c`, Goku's `$20:81C2`): entering step 4 while Y and B are held sends
 * the script back to frame 6, step 1 — a loop a state can repeat, cut at
 * both its ends.
 */
const HAND_CUTS: Record<number, number[]> = { 0x0c: [1, 4] };
/** Move 30: the original's hold, where a throw keeps the opponent. */
const HOLD = 0x30;
