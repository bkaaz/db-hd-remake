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
