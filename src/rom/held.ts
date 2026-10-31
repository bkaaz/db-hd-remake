import type { Anim } from "../entity/entityFile";
import { scriptAt } from "./cartridge";
import { fighterTables, ROSTER } from "./roster";
import { readScript, type ScriptOp } from "./script";

/**
 * Every way a fighter can be held (ADR 0035): for each thrower of the roster
 * and each of his moves with an opponent track (script command `80`), the
 * drawings that track names for this fighter's character, each held as
 * long as the thrower's step — `m30_<thrower>_<move>`, move `30` being the
 * original's hold, which plays no script of its own.
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
      const anim = heldIn(ops, character);
      if (anim) out[`m30_${thrower}_${move.toString(16).padStart(2, "0")}`] = anim;
    }
  });
  return out;
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
