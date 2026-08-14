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
   * Velocity set **on entering** the state, as an impulse: X facing-relative
   * (+ = forward), Y negative = upward. This is how a jump starts; from then on
   * physics owns the velocity.
   */
  launch?: [number, number];
  /**
   * While true the entity is off the ground: gravity pulls on it every frame
   * and its velocity carries (momentum), instead of `vel` being re-applied.
   */
  airborne?: boolean;
  /**
   * Velocity in px per game frame, X measured **in the facing direction**
   * (+ = forward, − = backward), like box coordinates. Y is reserved until
   * gravity exists and is ignored for now.
   */
  vel?: [number, number];
  /** Whether the entity may turn to face its opponent while in this state. */
  turn?: boolean;
  /**
   * The reaction this state's attack forces on whoever it hits — the name of a
   * state **on the defender**, not here. This is how one fighter distinguishes
   * a jab from a smash: the blow decides how it is taken, not the body taking
   * it. Falls back to the defender's own `onGotHit` when a state names nothing.
   *
   * Reaction names are therefore a small shared vocabulary every fighter is
   * expected to implement (`hurt`, later `hurt_heavy`, `knockdown`).
   */
  onHit?: string;
  /**
   * Game frames both fighters freeze for when this state's attack connects,
   * overriding the entity's `hitstop` attribute. A heavier blow wants a longer
   * pause, and that belongs to the blow rather than to either body.
   */
  hitstop?: number;
  /**
   * Effect entity spawned where this state's attack connects. Same idea as
   * `onHit` and `hitstop`: the blow decides how it is taken, how long the game
   * stops, and what the impact looks like. Defaults to the engine's `spark_1`.
   */
  hitFx?: string;
  /**
   * Health this state's attack takes off, overriding the entity's `damage`
   * attribute. The fourth of the same family: the blow decides how it is taken,
   * how long the game stops, what it looks like and what it costs.
   */
  damage?: number;
  /** Sound played on entering this state — the swing, not the impact. */
  sound?: string;
  /** Sound this state's attack makes when it lands. */
  hitSound?: string;
  /** Sound this state's attack makes when it is blocked. */
  blockSound?: string;
  /** Evaluated in order; the first firing transition wins. */
  transitions?: Transition[];
}

export interface StatesFile {
  initial: string;
  /**
   * State forced on the entity when an attack connects, whatever it was doing.
   * MUGEN does the same with its GetHit state; keeping it a single field means
   * no state has to remember to handle being hit.
   */
  onGotHit?: string;
  /**
   * State forced on this entity when it blocks a blow: the same idea as
   * `onGotHit`, for the case where the defender was holding back at the moment
   * of contact. Absent means this fighter cannot block at all.
   */
  onGuard?: string;
  states: Record<string, StateDef>;
}

/** What the entity's controller is asking for this frame, facing-relative. */
export interface InputSnapshot {
  fwd: boolean;
  back: boolean;
  /** Up is a world direction, not facing-relative — it starts a jump. */
  up: boolean;
  /** Down is a world direction too — it starts a crouch. */
  down: boolean;
  /** Punch button went down **this frame** (edge, not held). */
  punch: boolean;
  /** Kick button went down **this frame** (edge, not held). */
  kick: boolean;
  /** Heavy punch button went down **this frame**. */
  punchHeavy: boolean;
  /** Heavy kick button went down **this frame**. */
  kickHeavy: boolean;
}

/** Things that happened to the entity this frame, rather than being asked for. */
export interface Signals {
  /** A non-looping animation reached its end (latched until it changes). */
  animEnded: boolean;
  /** Moving downward — true from the apex of a jump onward. */
  falling: boolean;
  /**
   * Falling and within `landCue` of the ground — the cue to start a landing
   * pose *before* touching down, so it is visible rather than a flicker.
   */
  nearGround: boolean;
  /** The entity touched the ground (latched until the state changes). */
  landed: boolean;
}

/** Every trigger the runner understands, for validation and editor UI. */
export const TRIGGERS = [
  "held:fwd",
  "held:back",
  "held:up",
  "held:down",
  "pressed:punch",
  "pressed:kick",
  "pressed:punchHeavy",
  "pressed:kickHeavy",
  "animEnd",
  "falling",
  "nearGround",
  "landed",
] as const;

const FALLBACK_STATE: StateDef = { anim: "", vel: [0, 0], turn: false, transitions: [] };

const warned = new Set<string>();

function evaluate(trigger: string, input: InputSnapshot, signals: Signals): boolean {
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
    case "held:up":
      value = input.up;
      break;
    case "held:down":
      value = input.down;
      break;
    case "pressed:punch":
      value = input.punch;
      break;
    case "pressed:kick":
      value = input.kick;
      break;
    case "pressed:punchHeavy":
      value = input.punchHeavy;
      break;
    case "pressed:kickHeavy":
      value = input.kickHeavy;
      break;
    case "animEnd":
      value = signals.animEnded;
      break;
    case "falling":
      value = signals.falling;
      break;
    case "nearGround":
      value = signals.nearGround;
      break;
    case "landed":
      value = signals.landed;
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

/**
 * Which state a landed blow forces on the defender: the attacker's `onHit` if
 * its state names one, otherwise the defender's own `onGotHit`.
 *
 * The precedence is the rule that matters — the blow outranks the body, so a
 * heavy attack can stagger someone whose default reaction is a flinch, while an
 * attack that says nothing still gets the defender's default rather than
 * nothing at all.
 */
export function reactionFor(onHit: string | undefined, defender: StatesFile): string | undefined {
  return onHit ?? defender.onGotHit;
}

export class StateMachine {
  /** Name of the state the entity is in. */
  current: string;
  /**
   * The trigger that caused the last state change, or null. The caller needs it
   * to spend a buffered press: a press that fired a move must not fire another.
   */
  lastFired: string | null = null;

  constructor(private readonly file: StatesFile) {
    this.current = file.states[file.initial] ? file.initial : Object.keys(file.states)[0] ?? "";
  }

  /** Definition of the current state (a harmless empty state if unknown). */
  get def(): StateDef {
    return this.file.states[this.current] ?? FALLBACK_STATE;
  }

  /**
   * Enter a state regardless of transitions — the engine's override, used when
   * something happens *to* the entity (getting hit). Returns false if the state
   * does not exist.
   */
  force(name: string): boolean {
    if (!this.file.states[name]) return false;
    this.current = name;
    return true;
  }

  /**
   * Advance one game frame. At most one transition fires per frame, which keeps
   * behaviour predictable and makes state loops impossible.
   *
   * @returns the new state's name if it changed, else null.
   */
  update(input: InputSnapshot, signals: Signals): string | null {
    for (const t of this.def.transitions ?? []) {
      if (!evaluate(t.when, input, signals)) continue;
      if (!this.file.states[t.to]) {
        if (!warned.has(t.to)) {
          warned.add(t.to);
          console.warn(`[states] transition to unknown state "${t.to}" — ignored`);
        }
        continue;
      }
      if (t.to === this.current) return null;
      this.current = t.to;
      this.lastFired = t.when;
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
/** What the validator needs to know about an animation. */
export interface AnimInfo {
  loop: boolean;
  steps?: readonly { boxes?: readonly { type: string }[] }[];
}

/** The spark a blow leaves when its state does not name one. */
export const DEFAULT_HIT_FX = "spark_1";

/**
 * Every spawn an entity's states can ask for, so the game loads exactly those.
 *
 * `DEFAULT_HIT_FX` is always included: a state that names no `hitFx` still
 * leaves a spark, and an attack that forgot to say which one is the normal case
 * rather than the exception.
 */
export function effectsNamed(states: StatesFile | null | undefined): string[] {
  const names = new Set<string>([DEFAULT_HIT_FX]);
  for (const def of Object.values(states?.states ?? {})) {
    if (def.hitFx) names.add(def.hitFx);
  }
  return [...names];
}

export function validateStates(file: StatesFile, anims: Record<string, AnimInfo>): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const states = file?.states ?? {};
  const names = Object.keys(states);

  if (names.length === 0) {
    errors.push("no states defined");
    return { errors, warnings };
  }

  if (!file.initial) {
    errors.push(`"initial" is missing (expected one of: ${names.join(", ")})`);
  } else if (!states[file.initial]) {
    errors.push(`initial state "${file.initial}" does not exist`);
  }

  if (file.onGotHit !== undefined && !states[file.onGotHit]) {
    errors.push(`onGotHit state "${file.onGotHit}" does not exist`);
  }

  if (file.onGuard !== undefined && !states[file.onGuard]) {
    errors.push(`onGuard state "${file.onGuard}" does not exist`);
  }

  for (const [name, def] of Object.entries(states)) {
    const where = `state "${name}"`;

    const anim = def.anim ? anims[def.anim] : undefined;
    if (!def.anim) {
      errors.push(`${where}: no "anim"`);
    } else if (!anim) {
      errors.push(`${where}: unknown animation "${def.anim}"`);
    }

    // A step with no hurt box is a hole in the fighter: for those frames it
    // cannot be hit at all, and nothing on screen says so.
    const naked = (anim?.steps ?? [])
      .map((s, i) => (s.boxes?.some((b) => b.type === "hurt") ? -1 : i))
      .filter((i) => i >= 0);
    if (anim?.steps && naked.length > 0) {
      const which = naked.length === anim.steps.length ? "every step" : `step ${naked.join(", ")}`;
      warnings.push(
        `${where}: animation "${def.anim}" has no hurt box on ${which} — cannot be hit there`,
      );
    }

    // A state whose only way out is animEnd, playing a looping animation, is a
    // soft-lock: the animation never ends, so the entity never leaves. Easy to
    // create by forgetting to untick "loop" on an attack or a hit reaction.
    const exits = def.transitions ?? [];
    if (exits.length === 0) {
      warnings.push(`${where}: no transitions — nothing can leave it`);
    } else if (anim?.loop && exits.every((t) => t.when === "animEnd")) {
      warnings.push(
        `${where}: can never be left — animation "${def.anim}" loops, so animEnd never fires`,
      );
    }

    // A reaction lives on the *defender*, so a name this entity does not define
    // is only wrong once every fighter is expected to implement the vocabulary.
    // A warning until then — but a typo here fails silently, which is worse than
    // most, because the attack still connects and simply does nothing visible.
    if (def.onHit !== undefined && !states[def.onHit]) {
      warnings.push(
        `${where}: onHit reaction "${def.onHit}" is not a state of this entity — ` +
          `fine only if every opponent defines it`,
      );
    }

    if (def.hitstop !== undefined && (typeof def.hitstop !== "number" || def.hitstop < 0)) {
      errors.push(`${where}: "hitstop" must be a number of game frames, 0 or more`);
    }

    // Whatever puts a fighter in the air — a jump, an uppercut, a throw nobody
    // has written yet — has to say what happens when the ground arrives. Coming
    // down is the engine's job, but noticing it is the data's, and a state that
    // never asks stays airborne at ground level: no landing pose, no thud, no
    // way out. This is the one mistake a new launcher will make.
    if (def.airborne && !exits.some((t) => t.when === "landed" || t.when === "nearGround")) {
      warnings.push(
        `${where}: airborne with no "landed" or "nearGround" transition — ` +
          `nothing happens when it reaches the floor`,
      );
    }

    if (def.damage !== undefined && (typeof def.damage !== "number" || def.damage < 0)) {
      errors.push(`${where}: "damage" must be a number, 0 or more`);
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
  // The engine can force a reaction from anywhere, so `onGotHit` and every
  // `onHit` are entry points too — a reaction is never *transitioned* into.
  if (file.initial && states[file.initial]) {
    const roots = [file.initial];
    if (file.onGotHit && states[file.onGotHit]) roots.push(file.onGotHit);
    if (file.onGuard && states[file.onGuard]) roots.push(file.onGuard);
    for (const def of Object.values(states)) {
      if (def.onHit && states[def.onHit] && !roots.includes(def.onHit)) roots.push(def.onHit);
    }
    const seen = new Set<string>(roots);
    const queue = [...roots];
    for (let cur = queue.pop(); cur !== undefined; cur = queue.pop()) {
      for (const t of states[cur]?.transitions ?? []) {
        if (states[t.to] && !seen.has(t.to)) {
          seen.add(t.to);
          queue.push(t.to);
        }
      }
    }
    for (const n of names) {
      if (!seen.has(n)) warnings.push(`state "${n}" is unreachable (no transition leads to it)`);
    }
  }

  return { errors, warnings };
}
