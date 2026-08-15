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
  /**
   * Trigger expression, e.g. "held:fwd" or "!held:back" — or a **list, all of
   * which must hold**. A chain link needs two facts at once ("my attack
   * connected" and "a button was pressed"), and so will a command normal
   * (forward plus a button), so the conjunction is the general shape rather
   * than a special trigger per pair.
   */
  when: string | string[];
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
   *
   * **`null` in a component keeps that axis** instead of setting it, which is
   * what a bounce wants: it decides how high you come back up and has no
   * business deciding how fast you were already skidding. Without it a bounce
   * has to name a horizontal speed, and any number it names is right for one
   * launcher and wrong for the next.
   */
  launch?: [number | null, number | null];
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
   * The state to use instead of this one when the entity being forced into it
   * is off the ground — an air version of a reaction.
   *
   * It hangs off the *reaction* rather than off every attack on purpose: there
   * are three ways to be hit and there will be dozens of attacks, so an attack
   * names one `onHit` and gets the right air version of it for free. A blow
   * that knocks you over does so whether or not you were jumping; what changes
   * is the pose and the impulse, and both belong to the reaction.
   *
   * One hop only, and only on a forced entry — a state never redirects into a
   * transition it chose itself.
   */
  ifAirborne?: string;
  /**
   * How severe a reaction this is: flinch below stagger below knockdown below
   * lying on the floor. Absent means 0, which is every state that is not a
   * reaction — so any reaction outranks standing there.
   *
   * The rule it exists for: **a blow never lowers the rank the defender is
   * already in.** A jab does not rescue someone in the middle of being knocked
   * down, and does not stand a floored fighter back up. Being helpless is a
   * stronger fact than being hit lightly, and severity is one number rather
   * than a table of which reaction may replace which — which would grow with
   * every fighter and every reaction.
   */
  rank?: number;
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
  /**
   * Whether blows pass straight through this entity while it is here. Not "a
   * hit for no damage": nothing connects at all, so there is no spark, no
   * noise, the combo does not grow and the attacker's swing is not spent — the
   * same active frames may still land once the state is over.
   *
   * It is what a fighter on the floor needs and rank cannot give. Rank already
   * stops anything *interrupting* a knockdown, but a refused reaction still
   * costs health, so a body that can neither block nor move takes free damage
   * for as long as the attacker keeps swinging.
   */
  invulnerable?: boolean;
  /**
   * Whether this state's attack may lift or floor a body that is already
   * helpless — a **smash**. Only `SMASH_LIMIT` of them land in one combo; past
   * that the blow still connects and still hurts, but the victim keeps falling
   * on the arc they were already on.
   *
   * It is authored on the blow rather than derived from whether its reaction
   * launches, because the two questions differ: every knockdown launches, and
   * only some of them are meant to be able to do it twice.
   */
  smash?: boolean;
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
  /**
   * The four attack buttons, by strength rather than by limb — which blow is a
   * punch and which a kick is the character's business. Each went down **this
   * frame** (edge, not held).
   */
  light: boolean;
  medium: boolean;
  heavy: boolean;
  special: boolean;
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
  /**
   * The attack this entity is in has **connected** — landed or been blocked,
   * but never merely swung. It is what lets an attack be cancelled into the
   * next link of a chain, and the reason a whiff ends a string: swinging at air
   * has to be punishable or both players just hold the button down.
   */
  hitConfirmed: boolean;
}

/** Every trigger the runner understands, for validation and editor UI. */
export const TRIGGERS = [
  "held:fwd",
  "held:back",
  "held:up",
  "held:down",
  "pressed:light",
  "pressed:medium",
  "pressed:heavy",
  "pressed:special",
  "animEnd",
  "falling",
  "nearGround",
  "landed",
  "hitConfirmed",
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
    case "pressed:light":
      value = input.light;
      break;
    case "pressed:medium":
      value = input.medium;
      break;
    case "pressed:heavy":
      value = input.heavy;
      break;
    case "pressed:special":
      value = input.special;
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
    case "hitConfirmed":
      value = signals.hitConfirmed;
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

/** A `when` fires when every trigger in it does; a lone string is a list of one. */
function fires(when: string | string[], input: InputSnapshot, signals: Signals): boolean {
  return triggersOf(when).every((t) => evaluate(t, input, signals));
}

const triggersOf = (when: string | string[]): string[] => (Array.isArray(when) ? when : [when]);

/**
 * The button a transition spent, or null. A press that started a move must not
 * start a second one when the move ends and the buffer has not expired yet, so
 * whoever owns the buffer has to know which press was used — and only this
 * module knows how a trigger is spelled.
 */
const pressIn = (when: string | string[]): string | null => {
  const pressed = triggersOf(when).find((t) => t.startsWith("pressed:"));
  return pressed ? pressed.slice("pressed:".length) : null;
};

/**
 * Which state a landed blow forces on the defender: the attacker's `onHit` if
 * its state names one, otherwise the defender's own `onGotHit` — and then the
 * air version of that, if the defender is off the ground and one is named.
 *
 * The precedence is the rule that matters — the blow outranks the body, so a
 * heavy attack can stagger someone whose default reaction is a flinch, while an
 * attack that says nothing still gets the defender's default rather than
 * nothing at all. Being airborne comes after that, because it changes only
 * *how* a chosen reaction is taken, never which one: the blow that would knock
 * you down still knocks you down in the air.
 *
 * **Severity has the last word.** A reaction that ranks below the state the
 * defender is already in is refused, and `undefined` comes back: the blow still
 * connected and still hurt, it just did not interrupt. That is what stops a jab
 * from rescuing someone mid-knockdown or standing a floored fighter up.
 */
export function reactionFor(
  onHit: string | undefined,
  defender: StatesFile,
  current: StateDef | undefined,
): string | undefined {
  const chosen = onHit ?? defender.onGotHit;
  if (chosen === undefined) return undefined;

  // No air version means the ground reaction, which is what fighters without
  // air reactions have always got. Nothing here can invent one.
  const name = current?.airborne ? defender.states[chosen]?.ifAirborne ?? chosen : chosen;

  // Severity is the last word. Undefined means the blow lands — it costs health
  // and makes its noise — but changes nothing: the defender keeps falling on
  // the arc they were already on, or stays on the floor.
  const rank = defender.states[name]?.rank ?? 0;
  return rank >= (current?.rank ?? 0) ? name : undefined;
}

export class StateMachine {
  /** Name of the state the entity is in. */
  current: string;
  /**
   * The attack button the last state change consumed, or null — the name alone
   * (`"medium"`), not the trigger it was spelled with. A press that started a
   * move must not start a second one when the move ends and the buffer has not
   * expired yet, so whoever owns the buffer has to be told what was used. Once
   * a transition can require several triggers at once there is no single
   * "trigger that fired" to report, and this was the only thing anyone wanted
   * from it.
   */
  pressSpent: string | null = null;

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
      if (!fires(t.when, input, signals)) continue;
      if (!this.file.states[t.to]) {
        if (!warned.has(t.to)) {
          warned.add(t.to);
          console.warn(`[states] transition to unknown state "${t.to}" — ignored`);
        }
        continue;
      }
      if (t.to === this.current) return null;
      this.current = t.to;
      this.pressSpent = pressIn(t.when);
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

    // Unlike `onHit`, this names a state of *this* entity, so a missing one is
    // an error rather than a warning. A version that is not itself airborne
    // would drop the defender to the floor on the frame it starts — the exact
    // failure `ifAirborne` exists to prevent.
    if (def.ifAirborne !== undefined) {
      const air = states[def.ifAirborne];
      if (!air) {
        errors.push(`${where}: ifAirborne "${def.ifAirborne}" is not a state`);
      } else if (!air.airborne) {
        warnings.push(
          `${where}: ifAirborne "${def.ifAirborne}" is not airborne — ` +
            `an entity sent there mid-jump snaps to the ground`,
        );
      }
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

    // Unlike `vel`, a component may be null — that means "keep this axis".
    if (
      def.launch !== undefined &&
      (!Array.isArray(def.launch) ||
        def.launch.length !== 2 ||
        def.launch.some((v) => v !== null && typeof v !== "number"))
    ) {
      errors.push(`${where}: "launch" must be two numbers or nulls, e.g. [null, -2.4]`);
    }

    if (def.rank !== undefined && (typeof def.rank !== "number" || def.rank < 0)) {
      errors.push(`${where}: "rank" must be a number, 0 or more`);
    }

    if (def.smash !== undefined && typeof def.smash !== "boolean") {
      errors.push(`${where}: "smash" must be true or false`);
    }

    if (def.invulnerable !== undefined && typeof def.invulnerable !== "boolean") {
      errors.push(`${where}: "invulnerable" must be true or false`);
    }

    // A state nobody can touch and nobody can leave is a fighter removed from
    // the match. The `no transitions` warning above does not cover it, because
    // there the entity was at least still hittable.
    if (def.invulnerable && exits.length === 0) {
      warnings.push(`${where}: invulnerable and has no transitions — nothing can end it`);
    }

    // A smash is a blow allowed to lift a body twice, so one that cannot lift
    // at all is a line that does nothing — usually the flag put on the wrong
    // state of a pair, which is invisible until a juggle refuses to end.
    if (def.smash && def.onHit && !(states[def.onHit]?.launch || states[def.onHit]?.ifAirborne)) {
      warnings.push(
        `${where}: "smash" but its reaction "${def.onHit}" neither launches nor has an air version`,
      );
    }

    (def.transitions ?? []).forEach((t, i) => {
      const at = `${where}, transition ${i}`;
      const triggers = t.when === undefined ? [] : triggersOf(t.when);
      if (triggers.length === 0) {
        errors.push(`${at}: no "when" trigger`);
      }
      for (const trigger of triggers) {
        const key = trigger?.startsWith("!") ? trigger.slice(1) : trigger;
        if (!key) {
          errors.push(`${at}: no "when" trigger`);
        } else if (!(TRIGGERS as readonly string[]).includes(key)) {
          errors.push(`${at}: unknown trigger "${key}" (known: ${TRIGGERS.join(", ")})`);
        }
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
      const def = states[cur];
      // An air version is an edge, not a root: it is reached exactly when the
      // reaction that names it is, and no sooner.
      const next = (def?.transitions ?? []).map((t) => t.to);
      if (def?.ifAirborne) next.push(def.ifAirborne);
      for (const to of next) {
        if (states[to] && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    for (const n of names) {
      if (!seen.has(n)) warnings.push(`state "${n}" is unreachable (no transition leads to it)`);
    }
  }

  return { errors, warnings };
}
