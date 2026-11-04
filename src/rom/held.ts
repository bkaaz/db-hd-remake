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
      const table = HANDLER_HOLDS[thrower]?.[move];
      const anim = table ? heldByTable(rom, table, character) : heldIn(ops, character);
      if (!anim) continue;
      // what the thrower's handler makes him cry out, on the step it does it on (Vegeta's throw: 30 at each blow)
      const cries = handlerFacts(rom, handlerAt(rom, c, move), stepStarts(ops).length, c).flatMap((f) =>
        f.who === "opponent" && f.sound !== undefined && f.frame !== null ? [{ frame: f.frame, id: f.sound }] : [],
      );
      out[`m30_${thrower}_${move.toString(16).padStart(2, "0")}`] = withCries(anim, cries);
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

/** The one drawing a handler's table holds this character in. */
export function heldByTable(rom: Uint8Array, hold: { table: number; frames: number }, character: number): Anim {
  const word = (address: number) => {
    const at = toFile(address);
    if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
    return rom[at] | (rom[at + 1] << 8);
  };
  const list = (hold.table & 0xff0000) | word(hold.table + 2 * character);
  return { loop: false, steps: [{ frame: String(word(list)), dur: hold.frames }] };
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
