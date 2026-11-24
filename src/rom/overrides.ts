import type { StateDef, StatesFile } from "../entity/states";

/**
 * Section file `overrides.json`: where a fighter's common states differ from
 * the common file — his blows, his speeds, the step his animation holds on.
 * Only the fields that differ, so a change to the common states reaches him
 * wherever he does not say otherwise. An object is merged field by field
 * (`fires`, `inputsOf`); anything else, an array too, is replaced whole.
 */
export type Overrides = Record<string, Partial<StateDef>>;

/**
 * `file`'s states with his overrides laid on. Only on a common state: his
 * specials and the states he replaces are his own, edited where they stand.
 * An override that names no state, or changes nothing, is an error.
 */
export function withOverrides(file: StatesFile, overrides: Overrides, own: { states: Record<string, unknown>; replaces?: string[] } | null): StatesFile {
  const states = { ...file.states };
  for (const [name, fields] of Object.entries(overrides)) {
    if (own && (name in own.states || own.replaces?.includes(name))) throw new Error(`"${name}" is overridden, but it is his own: edit it in specials.json`);
    if (!(name in states)) throw new Error(`"${name}" is overridden, but the common states make no such state for him`);
    const was = states[name] as unknown as Record<string, unknown>;
    const merged = merge(was, fields) as Record<string, unknown>;
    for (const key of Object.keys(fields)) {
      if (same(was[key], merged[key])) throw new Error(`"${name}.${key}" is overridden with what it is already`);
    }
    states[name] = merged as unknown as StateDef;
  }
  return { ...file, states };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function merge(base: unknown, over: unknown): unknown {
  if (!isObject(base) || !isObject(over)) return over;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
