import { toFile } from "./cartridge";

/**
 * A fighter's special moves as the cartridge's command table lists them
 * (`$0D:F085` reads it before the normals): which move, from where, for what
 * input. docs/rom.md, The buttons, has the layout and every one of Goku's.
 */
export interface Command {
  move: number;
  where: "ground" | "air" | "mode";
  /** Bytes 0–2: what it needs, as masks over the frame's flags (`conditions.ts`). */
  conditions: number[];
  /** Byte 3: health it costs as it starts, never the last point ($0D:EED7). */
  cost: number;
  /** Byte 6: the move the opponent is put in as it starts — the throw's hold ($0D:EF05) — or null. */
  opponentMove: number | null;
  /** The button and any direction held with it, as the pad's bits (`buttonName`). */
  button: number;
  /** Directions to pass through, oldest first, as the pad's high byte. */
  directions: number[];
}

/** `$3D:9EEF` + the fighter's offset from `$0D:F5CF`: 0x150 bytes each. */
const TABLES = 0x3d9eef;
const OFFSETS = 0x0df5cf;
/** `$0D:F2E6`: a 2-byte pointer per sequence, into bank `$0D`. */
const SEQUENCES = 0x0df2e6;
const AREAS: [Command["where"], number, number][] = [
  ["ground", 0x00, 0x88],
  ["air", 0x88, 0x40],
  ["mode", 0xc8, 0x88],
];
const ROW = 8;

export function readCommands(rom: Uint8Array, character: number): Command[] {
  const file = (address: number) => {
    const at = toFile(address);
    if (at === null) throw new Error(`${address.toString(16)} is not ROM`);
    return at;
  };
  const word = (at: number) => rom[at] | (rom[at + 1] << 8);
  const table = file(TABLES + word(file(OFFSETS) + 2 * character));
  const commands: Command[] = [];
  for (const [where, from, size] of AREAS) {
    for (let row = table + from; row < table + from + size; row += ROW) {
      const sequence = rom[row + 4];
      if (sequence >= 0x80) continue;
      const at = file((SEQUENCES & 0xff0000) | word(file(SEQUENCES) + 2 * sequence));
      const words: number[] = [];
      for (let p = at; word(p) !== 0 && words.length < 16; p += 2) words.push(word(p));
      commands.push({
        move: rom[row + 5],
        where,
        conditions: [...rom.subarray(row, row + 3)],
        cost: rom[row + 3],
        opponentMove: rom[row + 6] || null,
        button: words[0],
        // newest first in the cartridge; a player reads them the other way
        directions: words.slice(1).map((w) => w >> 8).reverse(),
      });
    }
  }
  return commands;
}

const ARROWS: Record<number, string> = {
  0x01: "→", 0x02: "←", 0x04: "↓", 0x08: "↑", 0x05: "↘", 0x06: "↙", 0x09: "↗", 0x0a: "↖",
};
const BUTTONS: [number, string][] = [[0x8000, "B"], [0x4000, "Y"], [0x0080, "A"], [0x0040, "X"]];
const SHOULDERS: [number, string][] = [[0x0020, "L"], [0x0010, "R"]];

/** A direction byte as an arrow, facing right; `?` for anything else. */
export function arrow(direction: number): string {
  return ARROWS[direction & 0x0f] ?? "?";
}

/**
 * What a command's first word asks for. Its bits in `C1C0` — B, Y, A, X and
 * → — must all be down ($0D:F10A). Bit `0x0008` asks for its directions and
 * shoulder buttons exactly (Double Kick, → + B); bit `0x1000` for any one of
 * them, beyond those already required (side slash, R + B; the throw's
 * ↓ ← → is met by its → already) — $0D:F15F.
 */
export function buttonName(word: number): string {
  const required = word & 0xc1c0;
  const extra = word & 0x0f30;
  const names = BUTTONS.filter(([bit]) => required & bit).map(([, name]) => name);
  const directions = (bits: number) => (bits & 0x0f00 ? [arrow(bits >> 8)] : []);
  const shoulders = (bits: number) => SHOULDERS.filter(([bit]) => bits & bit).map(([, name]) => name);
  let first = directions(required);
  if (word & 0x0008) first = [...directions(extra), ...shoulders(extra)];
  else if (word & 0x1000 && !(extra & required)) first = [...first, [...directions(extra), ...shoulders(extra)].join(" or ")];
  return [...first, ...names].join(" + ");
}
