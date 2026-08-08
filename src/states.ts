/**
 * State machine runner (Phase D, v0 — see docs/entity-editor.md).
 *
 * A state binds an animation + a velocity + transition rules; the entity is a
 * state machine driven by triggers. This module is pure logic: it knows nothing
 * about PixiJS, sprites or the world — the caller feeds it an input snapshot and
 * reacts to the state it returns.
 *
 * v0 vocabulary is deliberately tiny: `held:fwd`, `held:back`, `animEnd`, each
 * optionally negated with a leading `!`. `onEnter` effects, `hit` data and the
 * scripting escape hatch come in later slices.
 */

export interface Transition {
  /** Trigger expression, e.g. "held:fwd" or "!held:back". */
  when: string;
  /** State to enter when the trigger fires. */
  to: string;
}

export interface StateDef {
  /** Animation played while in this state. */
  anim: string;
  /**
   * Velocity in px per game frame, X measured **in the facing direction**
   * (+ = forward, − = backward), like box coordinates. Y is reserved until
   * gravity exists and is ignored for now.
   */
  vel?: [number, number];
  /** Whether the entity may turn to face its opponent while in this state. */
  turn?: boolean;
  /** Evaluated in order; the first firing transition wins. */
  transitions?: Transition[];
}

export interface StatesFile {
  initial: string;
  states: Record<string, StateDef>;
}

/** What the entity's controller is asking for this frame, facing-relative. */
export interface InputSnapshot {
  fwd: boolean;
  back: boolean;
}

/** Every trigger the runner understands, for validation and editor UI. */
export const TRIGGERS = ["held:fwd", "held:back", "animEnd"] as const;

const FALLBACK_STATE: StateDef = { anim: "", vel: [0, 0], turn: false, transitions: [] };

const warned = new Set<string>();

function evaluate(trigger: string, input: InputSnapshot, animEnded: boolean): boolean {
  const negated = trigger.startsWith("!");
  const key = negated ? trigger.slice(1) : trigger;
  let value: boolean;
  switch (key) {
    case "held:fwd":
      value = input.fwd;
      break;
    case "held:back":
      value = input.back;
      break;
    case "animEnd":
      value = animEnded;
      break;
    default:
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`[states] unknown trigger "${key}" — never fires`);
      }
      value = false;
  }
  return negated ? !value : value;
}

export class StateMachine {
  /** Name of the state the entity is in. */
  current: string;

  constructor(private readonly file: StatesFile) {
    this.current = file.states[file.initial] ? file.initial : Object.keys(file.states)[0] ?? "";
  }

  /** Definition of the current state (a harmless empty state if unknown). */
  get def(): StateDef {
    return this.file.states[this.current] ?? FALLBACK_STATE;
  }

  /**
   * Advance one game frame. At most one transition fires per frame, which keeps
   * behaviour predictable and makes state loops impossible.
   *
   * @returns the new state's name if it changed, else null.
   */
  update(input: InputSnapshot, animEnded: boolean): string | null {
    for (const t of this.def.transitions ?? []) {
      if (!evaluate(t.when, input, animEnded)) continue;
      if (!this.file.states[t.to]) {
        if (!warned.has(t.to)) {
          warned.add(t.to);
          console.warn(`[states] transition to unknown state "${t.to}" — ignored`);
        }
        continue;
      }
      if (t.to === this.current) return null;
      this.current = t.to;
      return this.current;
    }
    return null;
  }
}

// --- validation ----------------------------------------------------------

export interface Validation {
  /** Broken data: the state machine will not behave as authored. */
  errors: string[];
  /** Suspicious but runnable — usually a typo somewhere else. */
  warnings: string[];
}

/**
 * Check a hand-authored `states.json` against the entity's animations.
 *
 * States are authored as text for now (see docs/decisions.md), so the one real
 * risk is a silent typo in a cross-reference: an animation or target state that
 * does not exist. Both the game (at load) and the editor's States tab run this,
 * so the same mistake is reported the same way in both places.
 */
export function validateStates(file: StatesFile, animNames: readonly string[]): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const states = file?.states ?? {};
  const names = Object.keys(states);
  const anims = new Set(animNames);

  if (names.length === 0) {
    errors.push("no states defined");
    return { errors, warnings };
  }

  if (!file.initial) {
    errors.push(`"initial" is missing (expected one of: ${names.join(", ")})`);
  } else if (!states[file.initial]) {
    errors.push(`initial state "${file.initial}" does not exist`);
  }

  for (const [name, def] of Object.entries(states)) {
    const where = `state "${name}"`;

    if (!def.anim) {
      errors.push(`${where}: no "anim"`);
    } else if (!anims.has(def.anim)) {
      errors.push(`${where}: unknown animation "${def.anim}"`);
    }

    if (
      def.vel !== undefined &&
      (!Array.isArray(def.vel) || def.vel.length !== 2 || def.vel.some((v) => typeof v !== "number"))
    ) {
      errors.push(`${where}: "vel" must be two numbers, e.g. [0.83, 0]`);
    }

    (def.transitions ?? []).forEach((t, i) => {
      const at = `${where}, transition ${i}`;
      const key = t.when?.startsWith("!") ? t.when.slice(1) : t.when;
      if (!key) {
        errors.push(`${at}: no "when" trigger`);
      } else if (!(TRIGGERS as readonly string[]).includes(key)) {
        errors.push(`${at}: unknown trigger "${key}" (known: ${TRIGGERS.join(", ")})`);
      }
      if (!t.to) {
        errors.push(`${at}: no "to" state`);
      } else if (!states[t.to]) {
        errors.push(`${at}: unknown target state "${t.to}"`);
      }
    });
  }

  // A state nothing can reach is usually a typo in some transition's target.
  if (file.initial && states[file.initial]) {
    const seen = new Set<string>([file.initial]);
    const queue = [file.initial];
    for (let cur = queue.pop(); cur !== undefined; cur = queue.pop()) {
      for (const t of states[cur]?.transitions ?? []) {
        if (states[t.to] && !seen.has(t.to)) {
          seen.add(t.to);
          queue.push(t.to);
        }
      }
    }
    for (const n of names) {
      if (!seen.has(n)) warnings.push(`state "${n}" is unreachable from "${file.initial}"`);
    }
  }

  return { errors, warnings };
}
