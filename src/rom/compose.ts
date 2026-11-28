import { existsSync, readFileSync } from "node:fs";
import type { AnimInfo, StatesFile } from "../entity/states";
import { DEFAULT_STEP, withRush, type BlowAnim, type RushFile } from "../combat/rushSlots";
import { withCharges } from "../combat/smashCharge";
import { withCounter } from "../combat/counter";
import type { CommandsFile } from "../input/command";
import { inTableOrder } from "./entries";
import { withOverrides, type Overrides } from "./overrides";
import { withSpecials, type Groups, type SpecialsFile } from "./specials";
import { statesFrom } from "./template";

/**
 * A fighter's `states.json` from our files alone — the common states, his
 * overrides, his specials, his rush, his command table — never the cartridge: what the
 * cartridge says is a report beside it (`npm run rom -- states`), so a number
 * changed on purpose is never put back. `npm run states` writes it, and
 * `compose.test.ts` fails while a file on disk is not this.
 */

/** The states every fighter shares, by hand. */
export const COMMON = "data/template/states.json";
/** The lists of common states an entry's `from` names as `@name`. */
export const GROUPS = "data/template/groups.json";

export function composeStates(name: string): StatesFile {
  const dir = `data/entities/${name}`;
  const animations = readJson<Record<string, AnimInfo>>(`${dir}/animations.json`);
  const own = optional<SpecialsFile>(`${dir}/specials.json`);
  const made = statesFrom(readJson<StatesFile>(COMMON), {
    has: (a) => a in animations,
    // the common states hold no fighter's specials, nor his objects but by name
    special: () => false,
    foreign: (v) => v.startsWith("goku_"),
    blowOf: () => null,
  });
  const overridden = withOverrides(made.file, optional<Overrides>(`${dir}/overrides.json`) ?? {}, own);
  const merged = own ? withSpecials(overridden, own, readJson<Groups>(GROUPS)) : overridden;
  // his rush made of his picks: its steps, windows and ways in computed (combat/rushSlots.ts)
  const rush = optional<RushFile>(`${dir}/rush.json`);
  const { hitstun } = readJson<{ hitstun: number }>(`${dir}/attributes.json`);
  const blows = animations as unknown as Record<string, BlowAnim>;
  const withPicks = rush ? withRush(merged, blows, hitstun, rush.picks, rush.step ?? DEFAULT_STEP) : merged;
  // the enders he holds to charge, from each as the rush made it
  // his counter, its blow his chase's where he has one (combat/counter.ts)
  const rushed = withCounter(withCharges(withPicks, blows, rush?.charge));
  // his commands tried as the cartridge tries them, the table's last row first
  const commands = (optional<CommandsFile>(`${dir}/commands.json`)?.commands ?? []).map((c) => ({ move: parseInt(c.move, 16) }));
  const file = inTableOrder(rushed, commands);
  return { ...file, states: blowsSaid(file.states, animations) };
}

/**
 * A drawing may carry a hit box in a state that names no blow: a part of a
 * move whose reaction no type copies, or a pose reused in a reaction. The game
 * asks such a state to say 0 for itself (`validateStates`), and that is all
 * this says: ours hit with what `attackDamage` makes of nothing anyway.
 */
export function blowsSaid(states: StatesFile["states"], animations: Record<string, unknown>): StatesFile["states"] {
  const strikes = (anim: string | undefined) =>
    ((animations[anim ?? ""] as AnimInfo | undefined)?.steps ?? []).some((s) => s.boxes?.some((b) => b.type === "hit"));
  return Object.fromEntries(
    Object.entries(states).map(([name, def]) => [name, def.type === undefined && def.damage === undefined && strikes(def.anim) ? { ...def, damage: 0 } : def]),
  );
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function optional<T>(path: string): T | null {
  return existsSync(path) ? readJson<T>(path) : null;
}
