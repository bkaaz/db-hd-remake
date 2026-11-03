import type { StatesFile, Transition } from "../entity/states";
import type { FighterTables } from "./cartridge";
import { readCommands, type Command } from "./commands";
import { handlerAt, handlerFacts, type HandlerFact } from "./handler";
import { READS_COMMANDS } from "./routines";
import { moveOf } from "./todo";

/**
 * Where a command can start a move, and which wins when two are met: the
 * states are written by hand, and both went wrong unseen (the Double Kick
 * missing from the stand-up, the throw taking 9f), so this says it from the
 * code. Ground commands are asked of a state on the floor, the air's of one
 * in the air; what the handler reads them under (from frame 4, once landed)
 * is given, not judged — a state may stand for only part of its move.
 */

export interface MissingEntry {
  state: string;
  /** What the handler reads them under, as the port report says it; "" for always. */
  when: string;
  /** Commands of his that can start from it but have no `command:` entry. */
  moves: number[];
}

/** A command that follows one of his own moves (byte 1 bits 20–80, byte 2 bit 01) starts from no state of these. */
const follows = (c: Command) => (c.conditions[1] & 0xe0) !== 0 || (c.conditions[2] & 0x01) !== 0;

function readUnder(f: HandlerFact): string {
  return [f.from !== undefined ? `from frame ${f.from}` : f.frame !== null ? `on frame ${f.frame}` : "", ...(f.when ?? [])]
    .filter(Boolean)
    .join(", ");
}

/** The move a transition asks for by command, or null. */
function commandOf(tr: Transition): number | null {
  const w = [tr.when].flat().find((w) => w.startsWith("command:"));
  return w === undefined ? null : parseInt(w.slice(8), 16);
}

/**
 * `file` with each state's command entries in the cartridge's order: `$0D:EDF8`
 * tries the table's rows from the last back to the first (`$0D:EF31`), so a
 * later row wins when two are met — a0 or 9f over the throw, which falls
 * through when out of range as our entry's `grab` does. The entries go as one
 * block where the first of them stood, ahead of the buttons, as the reader
 * runs before `$0D:FEC8`; the rest keep their places.
 */
export function inTableOrder(file: StatesFile, commands: readonly Command[]): StatesFile {
  const rank = new Map(commands.map((c, i) => [c.move, commands.length - i]));
  const states = Object.fromEntries(
    Object.entries(file.states).map(([name, def]) => {
      const transitions = def.transitions ?? [];
      const asks = transitions.filter((tr) => commandOf(tr) !== null);
      if (asks.length === 0) return [name, def];
      const sorted = [...asks].sort((a, b) => (rank.get(commandOf(a)!) ?? 0) - (rank.get(commandOf(b)!) ?? 0));
      const first = transitions.findIndex((tr) => commandOf(tr) !== null);
      const rest = transitions.filter((tr) => commandOf(tr) === null);
      return [name, { ...def, transitions: [...rest.slice(0, first), ...sorted, ...rest.slice(first)] }];
    }),
  );
  return { ...file, states };
}

export function missingEntries(rom: Uint8Array, t: FighterTables, file: StatesFile): MissingEntry[] {
  const commands = readCommands(rom, t.character).filter((c) => c.where !== "mode" && !follows(c));
  const reads = new Map<number, string | null>();
  const readsCommands = (move: number) => {
    if (!reads.has(move)) {
      const fact = handlerFacts(rom, handlerAt(rom, t.character, move), 0, t.character).find((f) => f.what === READS_COMMANDS);
      reads.set(move, fact ? readUnder(fact) : null);
    }
    return reads.get(move)!;
  };
  const missing: MissingEntry[] = [];
  for (const [state, def] of Object.entries(file.states)) {
    const move = moveOf(def.anim);
    const when = move === null ? null : readsCommands(move);
    if (when === null) continue;
    const where = def.air || def.airborne ? "air" : "ground";
    const entered = new Set(
      (def.transitions ?? []).flatMap((tr) =>
        [tr.when].flat().flatMap((w) => (typeof w === "string" && w.startsWith("command:") ? [parseInt(w.slice(8), 16)] : [])),
      ),
    );
    const moves = commands.filter((c) => c.where === where && !entered.has(c.move)).map((c) => c.move);
    if (moves.length > 0) missing.push({ state, when, moves });
  }
  return missing;
}
