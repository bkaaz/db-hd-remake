import type { StatesFile } from "../entity/states";

/**
 * A fighter's states taken from another's. What every fighter shares —
 * walking, the normals, guarding, being hit — is one state machine on move
 * ids the whole engine uses, so it plays on his own animations (`mNN`) with
 * his own blows. The template's specials are its own and are dropped, and
 * so is a state playing an animation he lacks; an object of the template's
 * own (its dust, its shot) is cut out of the state that puts it out. A press
 * that led to a dropped state leads nowhere; anything else that did — the
 * animation's end, a landing, a state put in its place — goes where the
 * dropped state would have gone when its own animation ended.
 */

/** Keys whose value names a state. */
const POINTS_AT = ["to", "guard", "ifAirborne", "ifCrouching"];
/** What a player asks for, as against what happens to the fighter. */
const INPUT = /^(pressed|held|motion|close):/;

export interface Template {
  file: StatesFile;
  /** Dropped, with why. */
  dropped: Record<string, string>;
  /** What a kept state lost: the template's own objects it put out. */
  lost: Record<string, string[]>;
  /** Blows whose numbers became his: state, then [type, damage] before and after. */
  reblown: Record<string, [string, string]>;
  /** Shots that leave from where his hand is: state, then `at` before and after. */
  moved: Record<string, [[number, number], [number, number]]>;
}

export interface Fit {
  /** An animation he has. */
  has: (anim: string) => boolean;
  /** An animation of one of the template's specials. */
  special: (anim: string) => boolean;
  /** A value naming one of the template's own objects. */
  foreign: (value: string) => boolean;
  /** His blow for an animation, or null where his cartridge has none. */
  blowOf: (anim: string) => { type: string; damage: number } | null;
  /** Where his script puts out a shared object an animation fires (its `b0`), or null. */
  spawnAt?: (anim: string, spawn: string) => [number, number] | null;
}

export function statesFrom(template: StatesFile, fit: Fit): Template {
  const dropped: Record<string, string> = {};
  for (const [name, def] of Object.entries(template.states)) {
    if (def.anim && fit.special(def.anim)) dropped[name] = `the template's special ${def.anim}`;
    else if (def.anim && !fit.has(def.anim)) dropped[name] = `no ${def.anim}`;
  }
  const after = (name: string, seen = new Set<string>()): string | null => {
    if (!(name in dropped)) return name;
    if (seen.has(name)) return null;
    seen.add(name);
    const end = template.states[name].transitions?.find((t) => t.when === "animEnd")?.to;
    return end ? after(end, seen) : null;
  };

  const lost: Record<string, string[]> = {};
  const reblown: Record<string, [string, string]> = {};
  const moved: Template["moved"] = {};
  const states: StatesFile["states"] = {};
  for (const [name, def] of Object.entries(template.states)) {
    if (name in dropped) continue;
    const copy = { ...def } as Record<string, unknown>;
    for (const [key, value] of Object.entries(copy)) {
      const theirs = values(value).filter(fit.foreign);
      if (theirs.length === 0) continue;
      delete copy[key];
      (lost[name] ??= []).push(...theirs);
    }
    const state = redirect(copy, after) as typeof def;
    if (state.type !== undefined && state.anim) {
      const blow = fit.blowOf(state.anim);
      if (blow && (blow.type !== state.type || blow.damage !== state.damage)) {
        reblown[name] = [`${state.type} ${state.damage}`, `${blow.type} ${blow.damage}`];
        Object.assign(state, blow);
      }
    }
    const fires = state.fires;
    const at = fires && state.anim ? fit.spawnAt?.(state.anim, fires.spawn) : null;
    if (fires && at && (at[0] !== fires.at?.[0] || at[1] !== fires.at?.[1])) {
      moved[name] = [fires.at ?? [0, 0], at];
      state.fires = { ...fires, at };
    }
    states[name] = state;
  }
  const top = (name: string | undefined) => (name === undefined ? undefined : (after(name) ?? undefined));
  const file: StatesFile = { ...template, initial: top(template.initial)!, onGotHit: top(template.onGotHit), onGuard: top(template.onGuard), states };
  for (const key of ["onGotHit", "onGuard"] as const) if (file[key] === undefined) delete file[key];
  return { file, dropped, lost, reblown, moved };
}

/** Every string anywhere in a value. */
function values(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (Array.isArray(o)) return o.flatMap(values);
  if (o && typeof o === "object") return Object.values(o).flatMap(values);
  return [];
}

function isTransition(v: unknown): v is { when: unknown; to: string | null } {
  return !!v && typeof v === "object" && "to" in v && "when" in v;
}

/** A transition a player's press starts. */
function pressed(t: { when: unknown }): boolean {
  return values(t.when).some((w) => INPUT.test(w));
}

/** A state's pointers at dropped states sent on, and a transition with nowhere to go left out. */
function redirect(o: unknown, after: (name: string) => string | null): unknown {
  if (Array.isArray(o)) {
    return o
      .filter((v) => !(isTransition(v) && pressed(v) && v.to !== null && after(v.to) !== v.to))
      .map((v) => redirect(v, after))
      .filter((v) => !(isTransition(v) && v.to === null));
  }
  if (!o || typeof o !== "object") return o;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (POINTS_AT.includes(k) && typeof v === "string") {
      const to = after(v);
      if (to !== null || k === "to") out[k] = to;
    } else out[k] = redirect(v, after);
  }
  return out;
}
