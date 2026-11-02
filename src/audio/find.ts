/**
 * What a DSP recording asked for, set against what our bank already answers —
 * so a sound no clip is matched to is found by a command, not by hunting.
 * The finding itself (render the voices, compare with every clip) is
 * `scripts/samples.ts --find`; this is the bookkeeping around it. Pure.
 */

import type { Sounds } from "./sounds";

/** A line `tools/re/log-dsp.lua` writes when the game asks for a sound ($2141). */
const REQUEST = /^f(\d+) sound ([0-9a-f]+)/;

/** Every sound the game asked for, in order: the frame, and the cartridge's id. */
export function requests(log: string): { frame: number; id: number }[] {
  const out: { frame: number; id: number }[] = [];
  for (const line of log.split("\n")) {
    const m = REQUEST.exec(line);
    if (m) out.push({ frame: Number(m[1]), id: parseInt(m[2], 16) });
  }
  return out;
}

/**
 * The requests a person or the sound test made: one alone in its frame. The
 * game uploading music to the chip writes hundreds of bytes through the
 * same port in one frame — none of them a sound.
 */
export function single(asked: { frame: number; id: number }[]): { frame: number; id: number }[] {
  const perFrame = new Map<number, number>();
  for (const { frame } of asked) perFrame.set(frame, (perFrame.get(frame) ?? 0) + 1);
  return asked.filter(({ frame }) => perFrame.get(frame) === 1);
}

/** The cartridge's ids our banks answer (`rom`), to the entry's name — the shared bank and fighters' own. */
export function romIds(...banks: Sounds[]): Map<number, string> {
  const ids = new Map<number, string>();
  for (const bank of banks) for (const [name, spec] of Object.entries(bank)) if (spec.rom !== undefined && !ids.has(spec.rom)) ids.set(spec.rom, name);
  return ids;
}

/**
 * The id player one asks for where player two asked for `id` — the
 * cartridge shifts player two's by a byte a sound (`$0D:D852`, docs/rom.md);
 * `shifts` is that table, read by the caller. Undefined when no id shifts to it.
 */
export function playerOneOf(id: number, shifts: readonly number[]): number | undefined {
  const base = shifts.findIndex((by, from) => by !== 0 && from + by === id);
  return base < 0 ? undefined : base;
}

/** The ids asked for that no bank answers, nor as player two's, each with the first frame it was asked on. */
export function unanswered(asked: { frame: number; id: number }[], known: Map<number, string>, shifts: readonly number[] = []): { frame: number; id: number }[] {
  const seen = new Set<number>();
  const answered = (id: number) => known.has(id) || known.has(playerOneOf(id, shifts) ?? -1);
  return asked.filter(({ id }) => !answered(id) && !seen.has(id) && seen.add(id));
}

/**
 * Whether a clip's likeness is clear enough to write down without an ear:
 * high enough, and well above the next clip's. Below it, the three are for
 * the owner to choose from (`--find`'s 3d: 0.39 against 0.16 — clear).
 */
export function clearMatch(best: number, next: number): boolean {
  return best >= 0.3 && best >= 2 * next;
}

/**
 * Each row's column, in order: the pairing that never goes back — row i+1's
 * column after row i's — with the most likeness in all (`scores[row][col]`).
 * Our capture is the sound test played through, so its clips stand in the
 * order the sound test plays its ids; a weak likeness placed between two
 * strong ones is still placed. A row left without a column is null.
 */
export function alignInOrder(scores: readonly (readonly number[])[]): (number | null)[] {
  const rows = scores.length;
  const cols = rows ? scores[0].length : 0;
  // best[i][j]: the most likeness pairing the first i rows with the first j columns
  const best = Array.from({ length: rows + 1 }, () => new Float64Array(cols + 1));
  for (let i = 1; i <= rows; i++)
    for (let j = 1; j <= cols; j++)
      best[i][j] = Math.max(best[i - 1][j], best[i][j - 1], best[i - 1][j - 1] + scores[i - 1][j - 1]);
  const out: (number | null)[] = Array(rows).fill(null);
  for (let i = rows, j = cols; i > 0 && j > 0; ) {
    if (best[i][j] === best[i - 1][j]) i--;
    else if (best[i][j] === best[i][j - 1]) j--;
    else (out[i - 1] = j - 1), i--, j--;
  }
  return out;
}

/**
 * Rows `alignInOrder` left without a column, placed where their neighbours
 * leave exactly as many columns free as there are rows — a sound no likeness
 * can be measured for (one of the music's samples) still has its clip,
 * between the clips around it. A gap that does not fit stays null.
 */
export function fillGaps(order: readonly (number | null)[], cols: number): (number | null)[] {
  const out = [...order];
  for (let i = 0; i < out.length; ) {
    if (out[i] !== null) {
      i++;
      continue;
    }
    let end = i;
    while (end < out.length && out[end] === null) end++;
    const from = i === 0 ? 0 : out[i - 1]! + 1;
    const to = end === out.length ? cols : out[end]!;
    if (to - from === end - i) for (let k = i; k < end; k++) out[k] = from + (k - i);
    i = end;
  }
  return out;
}

