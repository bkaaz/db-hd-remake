import type { StatesFile } from "../entity/states";
import { NORMALS } from "./buttons";
import { scriptAt, type FighterTables } from "./cartridge";
import { readCommands } from "./commands";
import { handlerAt } from "./handler";
import { ROSTER } from "./roster";
import { readScript } from "./script";

/**
 * What is left to read for a fighter, given fighters already ported: a move
 * whose handler is the same code as a ported move's is read — its logic is
 * that move's, its numbers his own and taken by script — and a move with a
 * handler of his own is to read. Only the moves a player can reach (a
 * normal, a command) or a ported fighter plays count; the rest are a number.
 * What a ported fighter has read is worked out from his states, not kept.
 */

export interface Ported {
  name: string;
  t: FighterTables;
  states: StatesFile;
}

export interface Todo {
  /** Moves whose handler a ported move has: by whom, in which of his states. */
  read: { move: number; by: string; states: string[] }[];
  /**
   * Handlers no ported move has — one reading each, whichever of his moves
   * run it — with how many of the roster run it too: one read pays for all.
   */
  toRead: { handler: number; moves: number[]; fighters: number }[];
  /** Moves with a script nobody reaches by a button or plays yet. */
  elsewhere: number;
}

export function todo(rom: Uint8Array, t: FighterTables, ported: Ported[]): Todo {
  // every handler a ported fighter's states play, and where
  const known = new Map<number, { by: string; states: string[] }>();
  for (const p of ported) {
    for (const [name, def] of Object.entries(p.states.states)) {
      const move = moveOf(def.anim);
      if (move === null) continue;
      const handler = handlerAt(rom, p.t.character, move);
      const entry = known.get(handler) ?? { by: p.name, states: [] };
      if (entry.by === p.name && !entry.states.includes(name)) entry.states.push(name);
      known.set(handler, entry);
    }
  }
  const played = new Set(ported.flatMap((p) => Object.values(p.states.states).map((d) => moveOf(d.anim))));
  const commands = readCommands(rom, t.character);
  const asked = (move: number) => [
    ...(NORMALS[move] ? [NORMALS[move]] : []),
    ...commands.filter((c) => c.move === move).map((c) => c.where),
  ];

  const out: Todo = { read: [], toRead: [], elsewhere: 0 };
  for (let move = 0; move < 0x100; move++) {
    try {
      readScript(rom, scriptAt(rom, t, move));
    } catch {
      continue;
    }
    const handler = handlerAt(rom, t.character, move);
    const by = known.get(handler);
    if (by) out.read.push({ move, ...by });
    else if (asked(move).length || played.has(move)) {
      const same = out.toRead.find((r) => r.handler === handler);
      if (same) same.moves.push(move);
      else out.toRead.push({ handler, moves: [move], fighters: fightersRunning(rom, handler) });
    } else out.elsewhere++;
  }
  // the ones that pay for the most of the roster first
  out.toRead.sort((a, b) => b.fighters - a.fighters || a.moves[0] - b.moves[0]);
  return out;
}

/** How many of the roster run this handler for some move. */
function fightersRunning(rom: Uint8Array, handler: number): number {
  let n = 0;
  for (let c = 0; c < ROSTER.length; c++) {
    for (let move = 0; move < 0x100; move++) {
      if (handlerAt(rom, c, move) === handler) {
        n++;
        break;
      }
    }
  }
  return n;
}

/** The move an exported animation plays: m9d, m1b_3 → 0x9d, 0x1b. */
export function moveOf(anim: string | undefined): number | null {
  const id = /^m([0-9a-f]{2})(?:_\d+)?$/.exec(anim ?? "")?.[1];
  return id === undefined ? null : parseInt(id, 16);
}
