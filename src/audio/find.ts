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
