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
  /** A transition added to every state in `from`, ahead of the plain press of its button. */
  entries: { from: string[]; when: Transition["when"]; to: string }[];
  states: Record<string, StateDef>;
}

const PRESS = /^pressed:/;

/** `file` with his specials in it; a name taken or a state missing is an error, not a quiet skip. */
export function withSpecials(file: StatesFile, specials: SpecialsFile): StatesFile {
  const states = { ...file.states };
  for (const name of Object.keys(specials.states)) {
    if (name in states) throw new Error(`special "${name}" is a state the template makes already`);
    states[name] = specials.states[name];
  }
  for (const { from, when, to } of specials.entries) {
    if (!(to in specials.states)) throw new Error(`an entry leads to "${to}", which specials.json does not define`);
    const press = list(when).find((w) => PRESS.test(w));
    if (!press) throw new Error(`the entry to "${to}" presses no button`);
    for (const name of from) {
      const state = states[name];
      if (!state) throw new Error(`the entry to "${to}" is from "${name}", which is no state`);
      const transitions = state.transitions ?? [];
      // a command before the plain press of its button, or the press would take it first
      const at = transitions.findIndex((t) => list(t.when).includes(press));
      if (at < 0) throw new Error(`"${name}" has no ${press} to put the entry to "${to}" ahead of`);
      states[name] = { ...state, transitions: [...transitions.slice(0, at), { when, to }, ...transitions.slice(at)] };
    }
  }
  return { ...file, states };
}

function list(when: Transition["when"]): string[] {
  return typeof when === "string" ? [when] : when;
}
