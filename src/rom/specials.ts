/**
 * A fighter's own specials, written by hand in `specials.json`, merged into
 * the states the template makes for him (`template.ts`) — so the states
 * command can be run again without wiping them. The template drops the
 * other fighter's specials; this puts his own back.
 */

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
   * Template states his own handler plays differently (his far B slides,
   * his crouching B hits twice): named here, his version in `states`
   * replaces the template's whole — unnamed, a clash is still an error.
   */
  replaces?: string[];
}

/** What asks for a button: a press, or a command (ADR 0050). */
const ASKS = /^(pressed|command):/;

/** `file` with his specials in it; a name taken or a state missing is an error, not a quiet skip. */
export function withSpecials(file: StatesFile, specials: SpecialsFile): StatesFile {
  const states = { ...file.states };
  const replaces = new Set(specials.replaces ?? []);
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
    for (const name of from) {
      const state = states[name];
      if (!state) throw new Error(`the entry to "${to}" is from "${name}", which is no state`);
      const transitions = state.transitions ?? [];
      // ahead of every press, or a press of its button would take it first
      const at = Math.max(0, transitions.findIndex((t) => list(t.when).some((w) => ASKS.test(w))));
      states[name] = { ...state, transitions: [...transitions.slice(0, at), { when, to }, ...transitions.slice(at)] };
    }
  }
  return { ...file, states };
}

function list(when: Transition["when"]): string[] {
  return typeof when === "string" ? [when] : when;
}
