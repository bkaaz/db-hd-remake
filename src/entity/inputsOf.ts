import type { StateDef, StatesFile, Transition } from "./states";

/**
 * A state that, from one of its frames, starts whatever another state's
 * inputs would — the original's landing, a block from frame 4, a dash call
 * the routines idle calls (`$0F:9EB1`, `$0D:F9BD`; docs/rom.md, Where a move
 * can start another). Borrowed, not copied: idle's dozen entries written into
 * six more states would drift apart the first time one is edited. ADR 0061.
 */
export interface InputsOf {
  /** The state whose input transitions are tried — idle, or crouch for a crouching one. */
  state: string;
  /** The state's frame they are tried from; from its start when absent. */
  from?: number;
  /**
   * `buttons`: only what `$0F:9EB1` reads, commands and presses — not the
   * directions, nor the dash, which `$0D:F9BD` starts (the dash itself).
   */
  only?: "buttons";
}

/** What a player does or what holds of the two: never the lender's own clock (`animEnd`, `frames:`). */
const INPUT = /^!?(held|pressed|released|command|close|motion|grab|health)\b/;

/** Whether every trigger of a transition is an input — the rest are the lender's own business. */
function isInput(t: Transition): boolean {
  return [t.when].flat().every((w) => INPUT.test(w));
}

/** Whether a transition asks for a command or a button — not the dash, a direction in the original. */
function asksButton(t: Transition): boolean {
  return [t.when].flat().some((w) => w.startsWith("command:") || (w.startsWith("pressed:") && w !== "pressed:dash"));
}

/** The transitions `def` borrows on its frame `elapsed`, tried ahead of its own. */
export function borrowed(file: StatesFile, def: StateDef, elapsed: number): readonly Transition[] {
  const of = def.inputsOf;
  if (!of || elapsed < (of.from ?? 0)) return [];
  const theirs = (file.states[of.state]?.transitions ?? []).filter((t) => !t.queued && isInput(t));
  return of.only === "buttons" ? theirs.filter(asksButton) : theirs;
}

/** What is wrong with a state's `inputsOf`, as the validator says it. */
export function inputsOfErrors(where: string, def: StateDef, file: StatesFile): string[] {
  const of = def.inputsOf;
  if (of === undefined) return [];
  const lender = file.states[of.state];
  if (!lender) return [`${where}: "inputsOf" names "${of.state}", which is not a state`];
  if (lender.inputsOf) return [`${where}: "inputsOf" names "${of.state}", which borrows its own — one step only`];
  if (of.from !== undefined && (!Number.isInteger(of.from) || of.from < 0)) return [`${where}: "inputsOf.from" must be a frame, 0 or more`];
  if (of.only !== undefined && of.only !== "buttons") return [`${where}: "inputsOf.only" can only be "buttons"`];
  return [];
}
