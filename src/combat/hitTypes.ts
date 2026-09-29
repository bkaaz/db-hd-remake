import table from "../../data/hit-types.json";
import type { StateDef, StatesFile } from "../entity/states";

/**
 * Hit types: what a blow does to whoever it hits, named once and shared by
 * every fighter (`data/hit-types.json`). A blow is authored as an animation
 * plus a type, and the type is the **only** source of its numbers — a state
 * that names a type may not also set any of them, or the same blow would have
 * two answers to how much it costs.
 *
 * What stays on the state is what two blows of one type may differ in: the
 * cancel window, the sounds and the spark.
 */

/** The fields a type stands for, under the names a state would use for them. */
export const HIT_FIELDS = ["onHit", "damage", "hitstun", "hitstop", "relaunch"] as const;

export type HitType = Required<Pick<StateDef, (typeof HIT_FIELDS)[number]>> & {
  /** The two letters used when a blow is written down in conversation: `fl30`. */
  code: string;
};

export const HIT_TYPES: Readonly<Record<string, HitType>> = table;

/**
 * The same states with every `type` spelled out as the fields it stands for.
 * This is what the engine and `chains` read; `states.json` on disk keeps the
 * short form, because the editor saves it back. An unknown type is left alone
 * for `hitTypeErrors` to report.
 */
export function withHitTypes(
  file: StatesFile,
  types: Readonly<Record<string, HitType>> = HIT_TYPES,
): StatesFile {
  if (!file?.states) return file;
  const states: Record<string, StateDef> = {};
  for (const [name, def] of Object.entries(file.states)) {
    const type = def.type === undefined ? undefined : types[def.type];
    if (!type) {
      states[name] = def;
      continue;
    }
    const { code: _code, ...fields } = type;
    states[name] = { ...def, ...fields };
  }
  return { ...file, states };
}

/** A type nobody defined, or a type with numbers of its own beside it. */
export function hitTypeErrors(
  file: StatesFile,
  types: Readonly<Record<string, HitType>> = HIT_TYPES,
): string[] {
  const errors: string[] = [];
  for (const [name, def] of Object.entries(file?.states ?? {})) {
    if (def.type === undefined) continue;
    if (!types[def.type]) {
      errors.push(
        `state "${name}": unknown hit type "${def.type}" (known: ${Object.keys(types).join(", ")})`,
      );
    }
    const own = HIT_FIELDS.filter((f) => def[f] !== undefined);
    if (own.length > 0) {
      errors.push(
        `state "${name}": hit type "${def.type}" decides ${own.join(", ")} — remove them from the state`,
      );
    }
  }
  return errors;
}
