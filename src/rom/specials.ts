/**
 * A fighter's own specials, written by hand in `specials.json`, merged into
 * the states the template makes for him (`template.ts`) — so the states
 * command can be run again without wiping them. The template drops the
 * other fighter's specials; this puts his own back.
 */

import { createHash } from "node:crypto";
import type { StateDef, StatesFile, Transition } from "../entity/states";

/** Section file `specials.json`: his special states, and where each is asked for. */
export interface SpecialsFile {
  _comment?: string;
  /**
   * A transition added to every state in `from`, ahead of its first press or
   * command — or first, in a state with neither (`stand_up`): the cartridge
   * reads commands before the buttons alone (`$0D:F085`).
   */
  entries: { from: string[]; when: Transition["when"]; to: string }[];
  states: Record<string, StateDef>;
  /**
   * Common states his own handler plays differently (his far B slides, his
   * crouching B hits twice): named here, his version in `states` replaces the
   * common one whole — unnamed, a clash is still an error. Each with the
   * `fingerprint` of the common state his copy was last checked against, so a
   * change to the common one that passes his copy by is called out
   * (`staleCopies`) rather than lost.
   */
  replaces?: Record<string, string>;
  /**
   * Moves whose own handler is read and plays right through the template's
   * states on his own parts — his charge loops at other frames, which the
   * export cuts from his handler. `states` stops calling them "to read".
   */
  read?: string[];
  /**
   * The winner's poses, in place of the template's: `82` is the original's pose
   * above the arena and does not fit every fighter on the ground.
   */
  poses?: string[];
}

/**
 * Named lists of common states an entry's `from` may give as `@name`
 * (`data/template/groups.json`): a state added to where specials start from is
 * added once, not on every fighter's every entry.
 */
export type Groups = Record<string, string[]>;

/** What asks for a button: a press, or a command (ADR 0050). */
const ASKS = /^(pressed|command):/;

/** `file` with his specials in it; a name taken or a state missing is an error, not a quiet skip. */
export function withSpecials(file: StatesFile, specials: SpecialsFile, groups: Groups = {}): StatesFile {
  const states = { ...file.states };
  const replaces = new Set(Object.keys(specials.replaces ?? {}));
  for (const name of replaces) {
    if (!(name in states)) throw new Error(`"${name}" is replaced, but the template makes no such state`);
    if (!(name in specials.states)) throw new Error(`"${name}" is replaced, but specials.json does not define it`);
  }
  for (const name of Object.keys(specials.states)) {
    if (name in states && !replaces.has(name)) throw new Error(`special "${name}" is a state the template makes already`);
    states[name] = specials.states[name];
  }
  for (const { from, when, to } of specials.entries) {
    if (!(to in specials.states)) throw new Error(`an entry leads to "${to}", which specials.json does not define`);
    if (!list(when).some((w) => ASKS.test(w))) throw new Error(`the entry to "${to}" asks for no button`);
    for (const name of from.flatMap((n) => named(n, groups))) {
      const state = states[name];
      if (!state) throw new Error(`the entry to "${to}" is from "${name}", which is no state`);
      const transitions = state.transitions ?? [];
      // ahead of every press, or a press of its button would take it first
      const at = Math.max(0, transitions.findIndex((t) => list(t.when).some((w) => ASKS.test(w))));
      states[name] = { ...state, transitions: [...transitions.slice(0, at), { when, to }, ...transitions.slice(at)] };
    }
  }
  for (const pose of specials.poses ?? []) {
    if (!(pose in states)) throw new Error(`"${pose}" is a winner's pose, which is no state`);
  }
  const round = specials.poses && file.round ? { ...file.round, win: specials.poses } : file.round;
  return { ...file, states, round };
}

/** A common state, shortened to what tells one version of it from another. */
export function fingerprint(def: StateDef): string {
  return createHash("sha1").update(JSON.stringify(def)).digest("hex").slice(0, 8);
}

/** The states he replaces whose common state has changed since his copy was checked against it. */
export function staleCopies(common: StatesFile, specials: SpecialsFile): string[] {
  return Object.entries(specials.replaces ?? {})
    .filter(([name, print]) => common.states[name] && fingerprint(common.states[name]) !== print)
    .map(([name]) => name);
}

/** A state's name as it is, a group's as its states; a group nobody defined is an error. */
function named(name: string, groups: Groups): string[] {
  if (!name.startsWith("@")) return [name];
  const states = groups[name.slice(1)];
  if (!states) throw new Error(`"${name}" is no group (data/template/groups.json)`);
  return states;
}

function list(when: Transition["when"]): string[] {
  return typeof when === "string" ? [when] : when;
}
