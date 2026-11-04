import type { Anim } from "../entity/entityFile";
import { stepStarts } from "./animation";
import { scriptAt, toFile } from "./cartridge";
import { handlerAt, handlerFacts } from "./handler";
import { fighterTables, ROSTER } from "./roster";
import { readScript, type ScriptOp } from "./script";

/**
 * Every way a fighter can be held (ADR 0035): for each thrower of the roster
 * and each of his moves with an opponent track (script command `80`), the
 * drawings that track names for this fighter's character, each held as
 * long as the thrower's step — `m30_<thrower>_<move>`, move `30` being the
 * original's hold, which plays no script of its own. A handler may name them
 * itself instead of a track: `HANDLER_HOLDS`.
 */
export function heldAnims(rom: Uint8Array, character: number): Record<string, Anim> {
  const out: Record<string, Anim> = {};
  ROSTER.forEach((thrower, c) => {
    const t = fighterTables(rom, c);
    for (let move = 0; move < 0x100; move++) {
      let ops: ScriptOp[];
      try {
        ops = readScript(rom, scriptAt(rom, t, move));
      } catch {
        continue;
      }
      const name = `m30_${thrower}_${move.toString(16).padStart(2, "0")}`;
      const byStep = STEP_HOLDS[thrower]?.[move];
      if (byStep) {
        out[name] = heldByStep(rom, byStep.floor, character, ops);
        out[`${name}_air`] = heldByStep(rom, byStep.air, character, ops);
        continue;
      }
      const own = OWN_MOVE_HOLDS[thrower]?.[move];
      if (own) {
        out[name] = heldInOwnMove(rom, own, character);
        continue;
      }
      const table = HANDLER_HOLDS[thrower]?.[move];
      const anim = table ? heldByTable(rom, table, character) : heldIn(ops, character);
      if (!anim) continue;
      // what the thrower's handler makes him cry out, on the step it does it on (Vegeta's throw: 30 at each blow)
      const cries = handlerFacts(rom, handlerAt(rom, c, move), stepStarts(ops).length, c).flatMap((f) =>
        f.who === "opponent" && f.sound !== undefined && f.frame !== null ? [{ frame: f.frame, id: f.sound }] : [],
      );
      out[name] = withCries(anim, cries);
    }
  });
  return out;
}

/**
 * Holds whose drawing the handler writes into the opponent's field 0x0a from
 * a table of its own, rather than a track: one pointer per character (same
 * bank), to the word it shows him in for as many `frames` as it holds
 * (Gohan's 9d: `$20:A6F2` on `$20:A716`, every frame, the list's first word).
 */
const HANDLER_HOLDS: Partial<Record<string, Record<number, { table: number; frames: number }>>> = {
  gohan: { 0x9d: { table: 0x20a716, frames: 30 } },
};

/**
 * Holds whose table names a drawing per step of the thrower, one table for a
 * body on the floor (y 0xC8 or more) and one for a body off it, tested every
 * frame though he cannot move (Gohan's a9: `$20:AA53`).
 */
const STEP_HOLDS: Partial<Record<string, Record<number, { floor: number; air: number }>>> = {
  gohan: { 0xa9: { floor: 0x20aa72, air: 0x20aa86 } },
};

/**
 * Holds that are no track and no table: the thrower puts him in a move of his
 * own, stopped on its first drawing until the launch (Gotenks's 9d: move 34,
 * not 30, its handler `$20:BD5A`).
 */
const OWN_MOVE_HOLDS: Partial<Record<string, Record<number, { move: number; frames: number }>>> = {
  gotenks: { 0x9d: { move: 0x34, frames: 30 } },
};

/** This character's first drawing of the move he is put in, as long as he stays in it. */
export function heldInOwnMove(rom: Uint8Array, hold: { move: number; frames: number }, character: number): Anim {
  const ops = readScript(rom, scriptAt(rom, fighterTables(rom, character), hold.move));
  const drawing = ops.flatMap((op) => ((op.op === "hold" || op.op === "show") && op.drawing !== null ? [op.drawing] : []))[0];
  if (drawing === undefined) throw new Error(`move ${hold.move.toString(16)} of character ${character} draws nothing`);
  return { loop: false, steps: [{ frame: String(drawing), dur: hold.frames }] };
}

function wordAt(rom: Uint8Array, address: number): number {
  const at = toFile(address);
  if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
  return rom[at] | (rom[at + 1] << 8);
}

/** The list of drawings a handler's table keeps for this character: one pointer each, same bank. */
function listOf(rom: Uint8Array, table: number, character: number): number {
  return (table & 0xff0000) | wordAt(rom, table + 2 * character);
}

/** The one drawing a handler's table holds this character in. */
export function heldByTable(rom: Uint8Array, hold: { table: number; frames: number }, character: number): Anim {
  return { loop: false, steps: [{ frame: String(wordAt(rom, listOf(rom, hold.table, character))), dur: hold.frames }] };
}

/** This character's drawing for each step the thrower shows, as long as he shows it. */
export function heldByStep(rom: Uint8Array, table: number, character: number, ops: readonly ScriptOp[]): Anim {
  const list = listOf(rom, table, character);
  const shown = ops.flatMap((op) => (op.op === "show" && op.frames > 0 ? [op.frames] : []));
  return { loop: false, steps: shown.map((dur, i) => ({ frame: String(wordAt(rom, list + 2 * i)), dur })) };
}

/** The track's drawings for one character, step by step; null for a script with no track. */
export function heldIn(ops: readonly ScriptOp[], character: number): Anim | null {
  const steps: Anim["steps"] = [];
  let last: number | null = null;
  for (const op of ops) {
    if (op.op !== "show" || !op.opponent) continue;
    // a step whose entry names no drawing keeps the last one
    last = op.opponent[character] ?? last;
    if (last !== null && op.frames > 0) steps.push({ frame: String(last), dur: op.frames });
  }
  return steps.length ? { loop: false, steps } : null;
}

/** `anim` with each cry on the step that begins on its frame — the steps are the thrower's, frame for frame. */
export function withCries(anim: Anim, cries: { frame: number; id: number }[]): Anim {
  if (!cries.length) return anim;
  let at = 0;
  const steps = anim.steps.map((step) => {
    const here = cries.filter((c) => c.frame === at).map((c) => c.id);
    at += step.dur ?? 0;
    return here.length ? { ...step, sfx: [...(step.sfx ?? []), ...here] } : step;
  });
  return { ...anim, steps };
}
