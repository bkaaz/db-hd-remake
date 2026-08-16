import { pressIn, type StatesFile } from "../entity/states";
import { scaledHitstun } from "./scaling";

/**
 * What chains into what, **derived from `states.json`** — and whether the
 * arithmetic that makes a link a combo actually works.
 *
 * A chain is a conclusion about the data, never a second copy of it: a written
 * list of links would be wrong the first time a number moves, and twenty
 * fighters would mean twenty stale lists. So it is computed here, once, and the
 * three places that want it — the test, `npm run chains`, and later the editor —
 * all ask this module rather than each doing the sum their own way. Two
 * implementations of one formula disagree by a frame and nobody knows which is
 * lying.
 *
 * Pure: takes the two files as plain data, knows nothing about loading them.
 */

/** The little of an animation this needs: how long each step is, and which one hits. */
export interface AnimSteps {
  steps: { dur: number; boxes?: { type: string }[] }[];
}

/** One cancel from one attack into the next, with the sum spelled out. */
export interface Link {
  from: string;
  to: string;
  /** The button that fires it — two cancels out of one attack differ only by this. */
  on: string | null;
  /** Frames between the blow landing and the last frame it may be cancelled. */
  window: number;
  /** Start-up of the attack being cancelled into. */
  startup: number;
  /** The latest the next blow can land, counted from this one — window + start-up. */
  worst: number;
  /** Blows landed before this link fires, by the **longest** route into it. */
  depth: number;
  /** Hitstun this blow still gives at that depth, after scaling. */
  hitstun: number;
  /** Frames to spare. Negative means the defender is up before the next blow. */
  margin: number;
  /** The reaction is a knockdown: the chain ends here either way, so margin is moot. */
  launcher: boolean;
}

/** The trigger a chain hangs off — "connected, and still cancellable". */
const CANCEL = "cancelable";

/** How a string is *started*: a state that is not an attack, and what it takes. */
export interface Entry {
  /** The attack this opens. */
  to: string;
  /** The state you are in when you press — `idle`, `crouch`, `walk_fwd`. */
  from: string;
  /** The trigger as authored, e.g. `pressed:light` or `held:down + pressed:heavy`. */
  when: string;
}

/** Frames before the hit box appears. */
export function startupOf(anim: AnimSteps | undefined): number {
  let before = 0;
  for (const step of anim?.steps ?? []) {
    if ((step.boxes ?? []).some((b) => b.type === "hit")) return before;
    before += step.dur;
  }
  return before;
}

/** Frames the whole animation lasts. */
export function framesOf(anim: AnimSteps | undefined): number {
  return (anim?.steps ?? []).reduce((n, s) => n + s.dur, 0);
}

/**
 * Every way *into* an attack that is not a cancel — the openers.
 *
 * A cancel graph starts from nowhere without these: the string `A Z Z S` is only
 * half the answer, because nothing on it says that `A` from standing is what
 * gets you in, and that crouching gives a different move for the same button.
 * The sources are the states that take part in no chain of their own — standing,
 * walking, crouching — which is exactly what "you have control" looks like here.
 */
export function entriesOf(file: StatesFile): Entry[] {
  const attacks = attacksIn(file);
  return Object.entries(file.states).flatMap(([from, def]) =>
    // A source is a state you are *in charge of*: not an attack, and not a
    // reaction (which is what a rank means). That is "you have control", which
    // is the same fact the combo counter resets on.
    attacks.has(from) || def.rank
      ? []
      : (def.transitions ?? [])
          .filter((t) => attacks.has(t.to))
          .map((t) => ({ to: t.to, from, when: [t.when].flat().join(" + ") })),
  );
}

/**
 * Every attack in the file — a state that says what it does to whoever it hits.
 *
 * Attacks with no cancels belong on the graph too: "this move leads nowhere" is
 * a fact worth seeing, not a reason to leave it out.
 */
export function attacksIn(file: StatesFile): Set<string> {
  return new Set(
    Object.entries(file.states)
      .filter(([, def]) => def.onHit !== undefined)
      .map(([name]) => name),
  );
}

/**
 * The same openers, gathered by what you press.
 *
 * Standing, walking forward and walking back all open the same attacks with the
 * same button, so listing them one by one buries the fact in triplicate. What
 * matters is the input; *which* neutral state you were in is the footnote.
 */
export function openings(file: StatesFile): { to: string; when: string; from: string[] }[] {
  const grouped = new Map<string, { to: string; when: string; from: string[] }>();
  for (const e of entriesOf(file)) {
    const key = `${e.to}\u0000${e.when}`;
    const at = grouped.get(key) ?? { to: e.to, when: e.when, from: [] };
    at.from.push(e.from);
    grouped.set(key, at);
  }
  return [...grouped.values()];
}

/**
 * Every cancel in the file, with its arithmetic.
 *
 * `baseHitstun` is the entity's default, for attacks that name none of their
 * own — which is itself worth seeing in the output, since an attack falling back
 * to it is usually an attack nobody has tuned.
 */
export function chainLinks(
  file: StatesFile,
  anims: Record<string, AnimSteps>,
  baseHitstun: number,
): Link[] {
  const states = file.states;
  const pairs = Object.entries(states).flatMap(([from, def]) =>
    (def.transitions ?? [])
      .filter((t) => Array.isArray(t.when) && t.when.includes(CANCEL))
      .map((t) => ({ from, to: t.to, on: pressIn(t.when) })),
  );

  /**
   * Blows landed before a link fires. A state can be entered by more than one
   * route — a light feeds the middle of the kick string — and the **longest**
   * one is what matters, because that is where scaling has taken the most off.
   */
  const depth = (state: string, seen: string[] = []): number => {
    if (seen.includes(state)) return 0; // an authored loop: stop rather than hang
    const parents = pairs.filter((p) => p.to === state).map((p) => p.from);
    return parents.length === 0
      ? 0
      : 1 + Math.max(...parents.map((p) => depth(p, [...seen, state])));
  };

  return pairs.map(({ from, to, on }) => {
    const attack = states[from];
    const anim = anims[attack.anim];
    // No window means the whole animation is one, which is what every attack
    // did before `cancelBy` existed — and is usually the bug.
    const window = (attack.cancelBy ?? framesOf(anim)) - startupOf(anim);
    const startup = startupOf(anims[states[to]?.anim ?? ""]);
    const at = depth(from);
    const hitstun = scaledHitstun(attack.hitstun ?? baseHitstun, at);
    return {
      from,
      to,
      on,
      window,
      startup,
      worst: window + startup,
      depth: at,
      hitstun,
      margin: hitstun - (window + startup),
      launcher: !states[attack.onHit ?? ""]?.vel,
    };
  });
}
