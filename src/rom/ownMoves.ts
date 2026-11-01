import { NORMALS } from "./buttons";
import type { FighterTables } from "./cartridge";
import { readCommands } from "./commands";
import { moveParts } from "./parts";

/**
 * A fighter's own moves — what no other fighter's states may copy: every move
 * his command table picks, and every attack a special's handler goes on to
 * (Slash Down Kick's somersault `b1`, Saiyan Meteor's `ae`). A move below
 * `0x90` it sets — landing `3b`, a jump's fall `05`, the opponent's `30` —
 * is everyone's, and so is a normal.
 */
export function ownMoves(rom: Uint8Array, t: FighterTables): Set<number> {
  const found = new Set(readCommands(rom, t.character).map((c) => c.move));
  const queue = [...found];
  while (queue.length > 0) {
    const move = queue.shift()!;
    for (const fact of moveParts(rom, t, move).facts) {
      const next = fact.move;
      if (next === undefined || fact.who === "opponent" || next < 0x90 || next in NORMALS || found.has(next)) continue;
      found.add(next);
      queue.push(next);
    }
  }
  return found;
}
