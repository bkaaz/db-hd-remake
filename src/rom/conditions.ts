/**
 * What a command needs before it fires: bytes 0–2 of its row are masks over
 * flags the game rebuilds every frame into fighter fields 0x4C–0x4E
 * (`$0D:F650`), matched against them as two words — bytes 0–1 with fields
 * 0x4C–0x4D, bytes 1–2 with 0x4D–0x4E (`$0D:F0DD`). Each flag is what the
 * builder tests to set it; the ranges and move lists it reads are per
 * fighter, in bank `$0D` (`commandContext`). On a stage that scrolls
 * vertically the builder takes another path (`$0D:F83A`), not read here.
 */

import { toFile } from "./cartridge";

/** A fighter's own numbers the flags are built from. */
export interface CommandContext {
  /** Byte 2 bit `20`: within this many px of the opponent (`$0D:F95B`), 0 when unused. */
  near: number;
  /** Byte 2 bit `40`: within this many px — the throw's range (`$0D:F96F`). */
  grab: number;
  /** Byte 1 bits `20` / `80`: one of these moves of the fighter's own (`$0D:F8E7`). */
  listA: number[];
  /** Byte 1 bit `40`, byte 2 bit `01`: one of these (`$0D:F90E`). */
  listB: number[];
  /**
   * The fighter's own moves during which an opponent's distance flags are
   * not set — so no one can grab him in them (`$0D:F931`, read by the
   * opponent's character).
   */
  ungrabbable: number[];
}

export function commandContext(rom: Uint8Array, character: number): CommandContext {
  const file = (address: number) => {
    const at = toFile(address);
    if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
    return at;
  };
  const word = (at: number) => rom[at] | (rom[at + 1] << 8);
  const byChar = (table: number) => word(file(table) + 2 * character);
  const list = (table: number) => {
    const out: number[] = [];
    for (let at = file(0x0d0000 | byChar(table)); rom[at] !== 0; at++) out.push(rom[at]);
    return out;
  };
  return {
    near: byChar(0x0df95b),
    grab: byChar(0x0df96f),
    listA: list(0x0df8e7),
    listB: list(0x0df90e),
    ungrabbable: list(0x0df931),
  };
}

const hex = (n: number) => n.toString(16).padStart(2, "0");
const moves = (list: number[]) => (list.length ? list.map(hex).join(" ") : "none");

/** Each flag: its byte, its bit, and what it asks, in words. */
const FLAGS: [number, number, (c: CommandContext) => string][] = [
  [0, 0x01, () => "on the ground"],
  [0, 0x02, () => "in the air (field 0x31 clear)"],
  [0, 0x04, () => "the opponent on the ground"],
  [0, 0x08, () => "the opponent in the air"],
  [0, 0x10, () => "a stage that scrolls vertically"],
  [0, 0x20, () => "the opponent not in moves 0e, 10, 19–23, 31–3a (down, dizzy …)"],
  [0, 0x40, () => "health 80 or less"],
  [0, 0x80, () => "the opponent level or lower"],
  [1, 0x01, () => "the opponent higher"],
  [1, 0x02, () => "in a hit pause, the opponent in moves 13–20, 74–7f (reeling)"],
  [1, 0x04, () => "in a hit pause, the opponent in moves 0f–12, 72–73 ?"],
  [1, 0x10, () => "the opponent not reeling (moves 13–21, 42, 43)"],
  [1, 0x20, (c) => `in one of its moves ${moves(c.listA)}`],
  [1, 0x40, (c) => `in one of its moves ${moves(c.listB)}`],
  [1, 0x80, (c) => `in one of its moves ${moves(c.listA)}, done (field 0x25 bit 7 clear)`],
  [2, 0x01, (c) => `in one of its moves ${moves(c.listB)}, done`],
  [2, 0x10, () => "the opponent standing (move 00 or 03, field 0x25 bit 3 clear)"],
  [2, 0x20, (c) => `within ${c.near} px of an opponent standing still`],
  [2, 0x40, (c) => `within ${c.grab} px of an opponent standing still, not in a move he cannot be grabbed in`],
  // byte 2 bit 80 is set every frame: it asks nothing
];

/** A command row's bytes 0–2 as what they ask, in words. */
export function describeConditions(bytes: readonly number[], context: CommandContext): string[] {
  return FLAGS.filter(([byte, bit]) => (bytes[byte] ?? 0) & bit).map(([, , text]) => text(context));
}
