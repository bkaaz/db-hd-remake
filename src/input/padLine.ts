/**
 * The pad's last frames as a person reads them, for the recording: why a
 * command was not met is almost always one direction never held alone, and
 * only the frames show which. Separate from `command.ts`, which matches and
 * never describes. Pure.
 */

import { OURS, PAD, type PadHistory } from "./command";

const ARROWS: Record<number, string> = {
  0: "·",
  [PAD.fwd]: "→", [PAD.back]: "←", [PAD.down]: "↓", [PAD.up]: "↑",
  [PAD.down | PAD.fwd]: "↘", [PAD.down | PAD.back]: "↙",
  [PAD.up | PAD.fwd]: "↗", [PAD.up | PAD.back]: "↖",
};

/** One frame's stick; both ways at once — a keyboard can, the pad cannot — is `↔`, after any up or down. */
export function arrow(held: number): string {
  const dirs = held & 0x0f00;
  if ((dirs & (PAD.fwd | PAD.back)) === (PAD.fwd | PAD.back)) {
    return `${dirs & PAD.down ? "↓" : ""}${dirs & PAD.up ? "↑" : ""}↔`;
  }
  return ARROWS[dirs] ?? "?";
}

/** The stick over the last `frames` frames, oldest first, a run a direction: `←6 ↙3 ↓1 ↘2 →4`. */
export function stickLine(history: PadHistory, frames: number): string {
  const runs: [string, number][] = [];
  for (let back = frames - 1; back >= 0; back--) {
    const a = arrow(history.at(back).held);
    const last = runs[runs.length - 1];
    if (last && last[0] === a) last[1]++;
    else runs.push([a, 1]);
  }
  return runs.map(([a, n]) => `${a}${n}`).join(" ");
}

/** Our buttons that went down in this pad word, by name. */
export function pressedNames(word: number): string[] {
  return (Object.keys(OURS) as (keyof typeof OURS)[]).filter((b) => word & OURS[b]);
}
