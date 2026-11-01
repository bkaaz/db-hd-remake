/**
 * The cartridge's commands, matched as its reader matches them (`$0D:EDF8`,
 * `$0D:F15F`; docs/rom.md, the pad's history): a fighter's sequences come
 * from `commands.json`, written by `npm run rom -- commands`, and are read
 * back in time over a history of the pad, one entry a game frame.
 *
 * Separate from `motion.ts`, which stays `goku_old`'s: that one recognises
 * shapes we chose; this one has no shapes of its own, only the original's
 * words and windows (ADR 0050).
 *
 * Pure: no PixiJS, no DOM.
 */

/** Section file `commands.json`: every command of the fighter's table, on the ground and in the air. */
export interface CommandsFile {
  _comment?: string;
  commands: CommandDef[];
}

export interface CommandDef {
  /** The move it starts, as its animation is named: `"a4"` for `ma4`. */
  move: string;
  where: "ground" | "air";
  /** The sequence as the cartridge has it: the button word, then directions newest first, in hex. */
  words: string[];
  /** Sequences `17` / `18`: also met by the button *held* now (`$0D:F085`). */
  held?: boolean;
}

/** The pad's bits, facing right — what the words are written in. */
export const PAD = {
  B: 0x8000, Y: 0x4000, up: 0x0800, down: 0x0400, back: 0x0200, fwd: 0x0100,
  A: 0x0080, X: 0x0040, L: 0x0020, R: 0x0010,
} as const;

/** One game frame of the pad: what went down this frame, and what is down. */
export interface PadFrame {
  pressed: number;
  held: number;
}

const NOTHING: PadFrame = { pressed: 0, held: 0 };
/** `$63D0`: 0x1E0 bytes, a word a frame. */
const KEPT = 240;
/** How many frames back a command's button may have gone down (`$0D:EE7C`). */
const PRESS = 5;
/** `$6002`, `$6006`, `$600A`, as a fight starts (`$0E:8093`). */
const NEAR = 12;
const FAR = 24;
const CHARGE = 48;

/** The last frames of one fighter's pad, newest first. */
export class PadHistory {
  private readonly frames: PadFrame[] = [];

  record(frame: PadFrame): void {
    this.frames.unshift(frame);
    if (this.frames.length > KEPT) this.frames.pop();
  }

  /** The frame `back` frames ago; 0 is this one. */
  at(back: number): PadFrame {
    return this.frames[back] ?? NOTHING;
  }
}

/** Whether the pad's history meets `def` this frame. */
export function commandMet(def: CommandDef, history: PadHistory, chargeFree = false): boolean {
  const [button, ...rest] = def.words.map((w) => parseInt(w, 16));
  const press = find(history, 0, PRESS, (f) => (f.pressed & button & 0xc0c0) === (button & 0xc0c0));
  if (press >= 0 && withButton(button, history.at(press).held) && sequence(rest, history, press, chargeFree)) return true;
  if (!def.held) return false;
  const now = history.at(0).held;
  return (now & button & 0xc1c0) === (button & 0xc1c0) && withButton(button, now) && sequence(rest, history, 0, chargeFree);
}

/** What the button word asks to be held with it (`$0D:F15F`, its bits `0008` and `1000`). */
function withButton(button: number, held: number): boolean {
  if (button & 0x0008) {
    const mask = button & 0x0f00 ? 0x0f00 : 0x0030;
    return (held & mask) === (button & mask);
  }
  if (button & 0x1000) return (held & button & 0x0f30) !== 0;
  return true;
}

/**
 * The directions, newest first, each found within its window of the one
 * after it — the search goes on from the frame the last one matched.
 * `chargeFree` skips a charge's 48 frames (field `0x26` bit 4 `?`).
 */
function sequence(words: number[], history: PadHistory, from: number, chargeFree: boolean): boolean {
  let at = from;
  for (const word of words) {
    const dirs = word & 0x0f00;
    const window = word & 0x0002 ? FAR : NEAR;
    if (word & 0x0001) {
      at = find(history, at, NEAR, (f) => (f.held & dirs) !== 0);
      if (at < 0) return false;
      if (chargeFree) continue;
      for (let i = 0; i < CHARGE; i++) if ((history.at(at + i).held & dirs) === 0) return false;
      at += CHARGE - 1;
    } else if (word & 0x2000) {
      at = find(history, at, NEAR, (f) => (f.held & dirs) !== 0);
    } else if (word & 0x0004) {
      const buttons = word & 0xc0c0;
      at = buttons ? find(history, at, window, (f) => (f.pressed & buttons) !== 0) : at + 1;
    } else {
      // the whole word: exactly this direction, and no button held
      at = find(history, at, window, (f) => f.held === dirs);
    }
    if (at < 0) return false;
  }
  return true;
}

/** The first of `window` frames from `from` back that `test` holds for, or -1. */
function find(history: PadHistory, from: number, window: number, test: (f: PadFrame) => boolean): number {
  for (let i = 0; i < window; i++) if (test(history.at(from + i))) return from + i;
  return -1;
}
