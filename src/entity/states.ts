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

import type { BallDef } from "../combat/ball";
import type { BandDef } from "../combat/band";
import type { ReboundDef } from "../combat/rebound";
import { SHAKE_PATTERNS, type ShakeDef } from "../camera/shake";
import { hitTypeErrors, withHitTypes } from "../combat/hitTypes";
import { missWindow, type AnimSteps } from "../combat/swing";

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
   * Up again on entering, at a share of the speed the body last landed with
   * (`combat/rebound.ts`) — the knockdown's bounce. Horizontal speed is kept,
   * as the original keeps its push through the bounce.
   */
  rebound?: ReboundDef;
  /**
   * While true the entity is off the ground: gravity pulls on it every frame
   * and its velocity carries (momentum), instead of `vel` being re-applied.
   */
  airborne?: boolean;
  /**
   * While true the entity is low: crouching, blocking low, swinging from a
   * crouch. It changes nothing about physics — unlike `airborne` — and exists
   * only so a blow arriving can pick a reaction that stays down instead of
   * standing the defender up.
   *
   * It has to be a flag rather than a state name, because the situation
   * outlives the stance: the second blow of a string arrives while the
   * defender is already in a crouching reaction, and that reaction is low too.
   */
  crouching?: boolean;
  /**
   * Velocity in px per game frame, X measured **in the facing direction**
   * (+ = forward, − = backward), like box coordinates. Y is reserved until
   * gravity exists and is ignored for now.
   */
  vel?: [number, number];
  /**
   * Forward speed changing during the state: `[frame, px per frame]` pairs,
   * each holding from that frame of the state until the next — how the
   * original's move code walks a fighter through a move (Quadruple Kick's
   * `$20:8663`). Before the first, `vel` holds. Ground only.
   */
  velAt?: [number, number][];
  /**
   * A shove on entering, in px per frame and facing-relative like `vel` — the
   * cartridge's knockback, which loses 0.25 a frame until it stops
   * (`combat/knockback.ts`). On top of `vel`, on the ground only.
   */
  shove?: number;
  /** Whether the entity may turn to face its opponent while in this state. */
  turn?: boolean;
  /**
   * The hit type of this state's attack, which decides `onHit`, `hitstun`,
   * `hitstop` and `relaunch` — a state naming one sets none of them itself,
   * and must set `damage`. See `combat/hitTypes.ts`.
   */
  type?: string;
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
   * The version of this reaction for a defender who is **crouching** — the same
   * idea as `ifAirborne`, one situation down. Without it a low fighter is stood
   * up by every blow they take, which loses the crouch they were holding.
   *
   * Airborne wins when a state somehow claims both: you cannot crouch in
   * mid-air, and a grounded reaction on a body in the air erases the jump.
   */
  ifCrouching?: string;
  /**
   * The block reaction to use while in this state, instead of the file's
   * `onGuard`. What it exists for is the crouching guard: the stance is the
   * only thing that still knows whether the defender was low when the blow
   * arrived.
   *
   * It hangs off the *stance* rather than off the attack, because how you
   * cover is a fact about you: the same jab is blocked standing or crouching
   * depending on what the defender was doing. An attack that must not be
   * blocked low is a different question and belongs to the attack.
   */
  guard?: string;
  /**
   * A blow arriving in this state is blocked. The guard is a stance the button
   * holds you in, and blockstun keeps it — a blocked string stays blocked — so
   * it is marked on the states rather than read off the button: a fighter who
   * holds guard through their own attack must not be blocking with it.
   */
  guarding?: boolean;
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
   * Game frames this state's attack holds its victim helpless, overriding the
   * entity's `hitstun` attribute. **The blow decides, not the pose**: a reaction
   * used to last exactly as long as its animation, which meant a drawing was
   * quietly setting frame data, and combos are nothing but
   * `defender's hitstun − attacker's recovery`.
   *
   * It owns the reaction's length in both directions — a shorter animation
   * holds its last frame, a longer one is cut off — because the alternative is
   * the two disagreeing and nobody knowing which won.
   *
   * Airborne reactions ignore it: they end when the ground arrives, and being
   * helpless in the air lasts as long as the fall.
   */
  hitstun?: number;

  /**
   * The last frame of this attack at which it may be **cancelled** into the
   * next link of a chain, counted from entering the state and not counting the
   * frames a hit pause froze — the same clock the defender's hitstun runs on.
   *
   * Without it the cancel window is the whole animation, which ties two things
   * that want opposite lengths: recovery should be long enough to read and to
   * punish, while the window should be short enough that the *latest* possible
   * cancel still lands inside the hitstun the blow gave (`combat.md`). One
   * number cannot be both, and the string quietly stops being a combo.
   *
   * Absent means "until the animation ends", which is what every attack did
   * before this existed.
   */
  cancelBy?: number;

  /**
   * Frames before this attack may connect **again**, while its hit box is still
   * out. Absent means one swing lands once, which is every attack that does not
   * set it.
   *
   * It is on the blow rather than in the animation because how often a move hits
   * and how it is drawn are different questions: a beam is one sprite held for
   * half a second, and ten hits should not mean ten authored steps. Three things
   * come with it and are the caller's problem, not this field's — every hit
   * scales the next (`combat/scaling.ts`), every hit freezes for `hitstop`, and
   * a multi-hit blow marked `relaunch` burns the relaunch budget in two.
   */
  rehit?: number;

  /**
   * Ki gained per frame while in this state, and spent when negative.
   *
   * On the state rather than in the engine because a `charge` state the engine
   * knew by name would be a rule the data cannot see. Absent means the state
   * leaves the meter alone, which is all of them but one. What a special pays
   * is `cost` below, not a negative rate: the price of a move is not a function
   * of how long its animation is.
   */
  ki?: number;

  /**
   * Ki spent **on entering** this state, and the price of admission: a
   * transition into it does not fire at all when the meter is short.
   *
   * One number rather than a cost plus a separate "can afford" trigger, which
   * are two ways to say one thing and can disagree. A special you cannot pay
   * for should not come out — not come out and do nothing.
   *
   * Distinct from `ki`, which is a rate: charging gains per frame, a special
   * pays once however long its animation runs.
   */
  cost?: number;

  /**
   * A spawn entity thrown into the world on entering this state — a projectile,
   * which unlike an effect goes on to hit somebody.
   *
   * `at` is where it appears, in sprite px from this entity's anchor and
   * facing-relative (+x = forward, −y = up), like a box. The moment is the
   * *entry*, so a move that charges before it fires is two states, which is how
   * this project already splits every move whose timing is drawn (the knee, the
   * hop). Nothing here says what the bolt does: it is an entity, and its own
   * states own its damage, its reaction and its speed.
   */
  /**
   * The ball this state holds in the hands while it charges — added light, not
   * a sprite (`combat/ball.ts`). A state without one lets it shrink away; a
   * state that `fires` takes it at once.
   */
  ball?: BallDef;
  /**
   * Whether this state's blow sets whoever it hits burning, until they land —
   * the Kamehameha's ($2A:99CC, `combat/palettes.ts`); shown on a defender with
   * `burn` sheets.
   */
  burns?: boolean;
  /** Frames the whole screen goes white when this state's blow lands — the Kamehameha's 16. */
  hitFlash?: number;
  /**
   * What this state's blow turns into where it lands — an effect put at the
   * middle of the boxes' overlap ($2A:8D63) in place of its `hitFx`: the
   * original's projectiles, each rewritten into its explosion ($2A:8E31).
   */
  burstsInto?: string;
  /**
   * An effect put on the floor under the entity as this state begins — the
   * dust a body raises hitting the ground, which the original puts at the
   * body's x on the floor line ($0D:DE6C), whatever the drawing shows.
   */
  groundFx?: string;
  /**
   * Shake the backdrop as this state begins, as the original's `$E3` does
   * (`camera/shake.ts`) — the knockdown's bounce sets `{ "pattern": 1,
   * "frames": 8 }`.
   */
  shake?: ShakeDef;

  /**
   * The band of light from the hands to the head of the beam this state threw
   * (`combat/band.ts`) — drawn while the head is in the world.
   */
  band?: BandDef;
  fires?: {
    spawn: string;
    at: [number, number];
    /**
     * How big the thing comes out at no charge and at full charge. It multiplies
     * the drawing and the boxes placed through it — a bigger bolt reaches
     * further — and **not** its speed: velocity is in sprite px per frame
     * against the world's scale, so folding size into that scale made a fully
     * charged bolt cross the stage in half the time (found in a recording,
     * 2026-08-25). Absent means one size.
     */
    size?: [number, number];
    /**
     * Which of the spawn's own states it starts in, when it has more than one
     * way to travel. The kamehameha's head is one entity with one drawing and
     * two flights — level and climbing — so the shape stays in the spawn's
     * `states.json`, where every other fact about how a bolt moves lives, and
     * the move only says which of them it wants. Absent means the spawn's own
     * `initial`.
     */
    state?: string;
    /**
     * Spawns put out beside it that never hit and are gone when it is — the
     * Kamehameha's base at the hands, which lives as long as the beam's head.
     */
    with?: { spawn: string; at: [number, number] }[];
  };
  /**
   * The step of the animation this state stops on and holds for as long as it
   * lasts — the Kamehameha's firing pose, held while the beam is in the air
   * rather than played out into the recovery behind it.
   */
  holdStep?: number;

  /**
   * Frames of holding this state for its charge to reach full. The level is a
   * fraction the *next* thing carries — what a charged move grows is whatever
   * it throws, not this state.
   *
   * A number rather than a rung per level: the owner's kamehameha charges
   * continuously and its bolt is scaled by how long you held it, so "small" and
   * "large" are two readings of one value and would be two states pretending to
   * be a dial. Reaching the top is the `charged` trigger, which is how a move
   * lets go of itself rather than waiting for a button that can add nothing.
   */
  charge?: number;

  /**
   * A sound **retriggered** for as long as this state lasts, rather than played
   * once on entering it.
   *
   * Not a seamless loop, which repeats at exactly the clip's own length and can
   * never overlap itself. The original's charge is one short clip fired again
   * before the last copy has finished, and the copies stacking is what turns a
   * repeat into a sustain. `loopEvery` is how often.
   *
   * Two states naming the same one hand it over rather than restarting the
   * clock, which is what keeps a hitch out of the seam between a drop-in pose
   * and its loop.
   */
  loopSound?: string;

  /** Frames between copies of `loopSound`. Shorter than the clip is the point. */
  loopEvery?: number;
  /**
   * Effect entity spawned where this state's attack connects. Same idea as
   * `onHit` and `hitstop`: the blow decides how it is taken, how long the game
   * stops, and what the impact looks like. Defaults to the engine's `spark_1`.
   */
  hitFx?: string;
  /**
   * Health this state's attack takes off — the blow's own, never its hit
   * type's or the entity's (ADR 0019). Required on every state whose
   * animation has a hit box.
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
   * helpless — a **relaunch**. Only `RELAUNCH_LIMIT` of them land in one combo; past
   * that the blow still connects and still hurts, but the victim keeps falling
   * on the arc they were already on.
   *
   * It is authored on the blow rather than derived from whether its reaction
   * launches, because the two questions differ: every knockdown launches, and
   * only some of them are meant to be able to do it twice.
   */
  relaunch?: boolean;
  /**
   * Sound played on entering this state — the swing, not the impact. A list
   * when the moment is more than one noise: a ki blast is the shot *and* the
   * shout, and those are two clips that have to be able to vary apart.
   */
  sound?: string | string[];
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
   * For a spawn put out beside a bolt (`fires.with`): the state it is forced
   * into when the bolt is gone, played out before it goes too — the
   * Kamehameha's base on its way out ($0F:E70F). Absent: gone with the bolt.
   */
  onRelease?: string;
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
   * The buttons — Burst Limit's attack, guard, smash and ki blast, then the
   * original's two that ours lacked (`strike`, its X; `dash`, its L/R). Each
   * went down **this frame** (edge, not held).
   */
  attack: boolean;
  guard: boolean;
  smash: boolean;
  blast: boolean;
  strike: boolean;
  dash: boolean;
  /**
   * A motion input completed inside its window — a *sequence* of directions,
   * where every `held:` above is one frame. Recognised in `input/motion.ts`;
   * each motion the runner knows gets a flag here.
   */
  qcf: boolean;
  qcb: boolean;
  hcf: boolean;
  dbf: boolean;
  /**
   * Buttons still down. Separate from the four edges above: a press is a
   * moment and this is a state, and only the second can express a stance you
   * hold.
   */
holding: { attack: boolean; guard: boolean; smash: boolean; blast: boolean; strike: boolean; dash: boolean };
}

/** Things that happened to the entity this frame, rather than being asked for. */
export interface Signals {
  /** A non-looping animation reached its end (latched until it changes). */
  animEnded: boolean;
  /**
   * The hitstun this entity was put in has run out — the defender's own clock,
   * counted down by the engine and untouched by how long the pose takes. True
   * whenever there is none left, so a state nobody stunned reads it as true and
   * a reaction reads it exactly once its blow has finished holding it.
   */
  stunEnded: boolean;
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
   * Per button: the opponent is nearer than the entity's `closeRange` for it —
   * how the original picks a close normal over a far one with the same button.
   * A button with no range is never close.
   */
  close: Readonly<Partial<Record<CloseButton, boolean>>>;
  /** Filled in by the state machine: frames this state has run (`frames:N`). */
  framesIn?: number;
  /** Filled in by the state machine: buttons let go since this state began (`released:`). */
  released?: ReadonlySet<string>;
  /**
   * The attack this entity is in has **connected** — landed or been blocked,
   * but never merely swung. A swing that has not may still be cancelled once
   * it has missed; the state machine works that out from its animation.
   */
  hitConfirmed: boolean;
  /** Ki in the meter right now — what a state's `cost` is measured against. */
  ki: number;
  /**
   * Nothing this entity fired is still in the world. True for anyone who has
   * thrown nothing, so a state that never fires reads it as "over" — the only
   * useful reading for a fighter holding a pose until his beam is gone.
   */
  spawnEnded: boolean;
  /**
   * The charge this entity is filling has reached the top. A separate fact from
   * the button being let go: a move that is full has nothing left to gain from
   * being held, and holding it longer than it can charge reads as the game
   * ignoring you.
   */
  charged: boolean;
}

/** The buttons that may have a close version, each its own `close:` trigger. */
export const CLOSE_BUTTONS = ["attack", "smash", "blast", "strike"] as const;
export type CloseButton = (typeof CLOSE_BUTTONS)[number];

/** Triggers carrying a number or a button: `frames:20`, `released:blast`. */
const COUNTED = /^(frames:\d+|released:(attack|guard|smash|blast|strike|dash))$/;

/** Every trigger the runner understands, for validation and editor UI. */
export const TRIGGERS = [
  "held:fwd",
  "held:back",
  "held:up",
  "held:down",
  "pressed:attack",
  "pressed:guard",
  "pressed:smash",
  "pressed:blast",
  "pressed:strike",
  "pressed:dash",
  "held:attack",
  "held:guard",
  "held:smash",
  "held:blast",
  "held:strike",
  "held:dash",
  "motion:qcf",
  "motion:qcb",
  "motion:hcf",
  "motion:dbf",
  "animEnd",
  "stunEnd",
  "spawnEnd",
  "charged",
  "falling",
  "nearGround",
  "landed",
  ...CLOSE_BUTTONS.map((b) => `close:${b}` as const),
  "cancelable",
] as const;

const FALLBACK_STATE: StateDef = { anim: "", vel: [0, 0], turn: false, transitions: [] };

const warned = new Set<string>();

/** `frames:N` and `released:<button>`, or undefined for any other trigger. */
function counted(key: string, signals: Signals): boolean | undefined {
  const [kind, arg] = key.split(":");
  // how long a charge has run decides what it becomes (the Kamehameha)
  if (kind === "frames") return (signals.framesIn ?? 0) >= Number(arg);
  // latched: a charge let go stays let go, however the button moves after
  if (kind === "released") return signals.released?.has(arg) === true;
  return undefined;
}

function evaluate(trigger: string, input: InputSnapshot, signals: Signals): boolean {
  const negated = trigger.startsWith("!");
  const key = negated ? trigger.slice(1) : trigger;
  const count = COUNTED.test(key) ? counted(key, signals) : undefined;
  if (count !== undefined) return negated ? !count : count;
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
    case "pressed:attack":
      value = input.attack;
      break;
    case "pressed:guard":
      value = input.guard;
      break;
    case "pressed:smash":
      value = input.smash;
      break;
    case "pressed:blast":
      value = input.blast;
      break;
    case "pressed:strike":
      value = input.strike;
      break;
    case "pressed:dash":
      value = input.dash;
      break;
    case "held:attack":
      value = input.holding.attack;
      break;
    case "held:guard":
      value = input.holding.guard;
      break;
    case "held:smash":
      value = input.holding.smash;
      break;
    case "held:blast":
      value = input.holding.blast;
      break;
    case "held:strike":
      value = input.holding.strike;
      break;
    case "held:dash":
      value = input.holding.dash;
      break;
    case "motion:qcf":
      value = input.qcf;
      break;
    case "motion:qcb":
      value = input.qcb;
      break;
    case "motion:hcf":
      value = input.hcf;
      break;
    case "motion:dbf":
      value = input.dbf;
      break;
    case "animEnd":
      value = signals.animEnded;
      break;
    case "stunEnd":
      value = signals.stunEnded;
      break;
    case "spawnEnd":
      value = signals.spawnEnded;
      break;
    case "charged":
      value = signals.charged;
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
    case "close:attack":
    case "close:smash":
    case "close:blast":
    case "close:strike":
      value = signals.close[key.slice("close:".length) as CloseButton] === true;
      break;
    case "cancelable":
      // Connected or missed, *and* inside the window for it — the state machine
      // narrows the signal before it gets here, see StateMachine.update.
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
export const pressIn = (when: string | string[]): string | null => {
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
/** Forward speed on the ground `frame` frames into a state: its `velAt`, else its `vel`. */
export function groundSpeed(def: StateDef, frame: number): number {
  let speed = def.vel?.[0] ?? 0;
  for (const [at, vx] of def.velAt ?? []) if (frame >= at) speed = vx;
  return speed;
}

export function reactionFor(
  onHit: string | undefined,
  defender: StatesFile,
  current: StateDef | undefined,
): string | undefined {
  const chosen = onHit ?? defender.onGotHit;
  if (chosen === undefined) return undefined;

  // No air version means the ground reaction, which is what fighters without
  // air reactions have always got. Nothing here can invent one.
  // The defender's situation picks the version; the blow already picked which
  // reaction it is. Nothing here can invent a version that was not authored.
  const redirect = current?.airborne
    ? defender.states[chosen]?.ifAirborne
    : current?.crouching
      ? defender.states[chosen]?.ifCrouching
      : undefined;
  const name = redirect ?? chosen;

  // Severity is the last word. Undefined means the blow lands — it costs health
  // and makes its noise — but changes nothing: the defender keeps falling on
  // the arc they were already on, or stays on the floor.
  const rank = defender.states[name]?.rank ?? 0;
  return rank >= (current?.rank ?? 0) ? name : undefined;
}

/**
 * Which block reaction covers a blow arriving right now: the stance's own if it
 * declares one, otherwise the fighter's default. Undefined means this fighter
 * cannot block at all.
 *
 * It reads the state rather than the attack because how you cover is a fact
 * about you: the same jab is blocked standing or crouching.
 */
export function guardStateFor(
  current: StateDef | undefined,
  file: StatesFile | null | undefined,
): string | undefined {
  const name = current?.guard ?? file?.onGuard;
  return name !== undefined && file?.states[name] ? name : undefined;
}

export class StateMachine {
  /** Name of the state the entity is in. */
  current: string;
  /**
   * The attack button the last state change consumed, or null — the name alone
   * (`"smash"`), not the trigger it was spelled with. A press that started a
   * move must not start a second one when the move ends and the buffer has not
   * expired yet, so whoever owns the buffer has to be told what was used. Once
   * a transition can require several triggers at once there is no single
   * "trigger that fired" to report, and this was the only thing anyone wanted
   * from it.
   */
  pressSpent: string | null = null;

  /**
   * Frames this state has run. Only used by the cancel windows, and counted
   * here rather than in the entity so the rule can be tested without a renderer.
   */
  private elapsed = 0;
  /** Buttons let go since this state began — `released:`. */
  private released = new Set<string>();

  /**
   * `anims` is only read for when a swing misses; without them a miss is
   * never cancellable, which is what a test about something else wants.
   */
  constructor(
    private readonly file: StatesFile,
    private readonly anims: Readonly<Record<string, AnimSteps>> = {},
  ) {
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
    this.elapsed = 0;
    this.released = new Set();
    return true;
  }

  /**
   * Advance one game frame. At most one transition fires per frame, which keeps
   * behaviour predictable and makes state loops impossible.
   *
   * @returns the new state's name if it changed, else null.
   */
  update(input: InputSnapshot, signals: Signals): string | null {
    this.elapsed++;
    for (const [button, down] of Object.entries(input.holding)) if (!down) this.released.add(button);
    // The signal is narrowed once, here, rather than at every transition: from
    // "connected" to "may be cancelled now", which a miss can be too.
    const now: Signals = {
      ...signals,
      hitConfirmed: this.cancelable(signals.hitConfirmed),
      framesIn: this.elapsed,
      released: this.released,
    };
    for (const t of this.def.transitions ?? []) {
      if (!fires(t.when, input, now)) continue;
      if (!this.file.states[t.to]) {
        if (!warned.has(t.to)) {
          warned.add(t.to);
          console.warn(`[states] transition to unknown state "${t.to}" — ignored`);
        }
        continue;
      }
      // A special nobody can pay for does not come out. Checked here rather
      // than in the entity so that the *next* transition still gets its turn:
      // the move is simply not among the options this frame.
      if ((this.file.states[t.to].cost ?? 0) > signals.ki) continue;
      if (t.to === this.current) return null;
      this.current = t.to;
      this.pressSpent = pressIn(t.when);
      this.elapsed = 0;
      this.released = new Set();
      return this.current;
    }
    return null;
  }

  /**
   * Inside this attack's cancel window: the one for a blow that connected
   * (the whole attack when it has no `cancelBy`), or the one for a miss.
   */
  private cancelable(connected: boolean): boolean {
    const by = this.def.cancelBy;
    if (connected) return by === undefined || this.elapsed <= by;
    const miss = missWindow(this.anims[this.def.anim], by);
    return miss !== null && this.elapsed >= miss[0] && this.elapsed <= miss[1];
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
 * States are authored as text for now (ADR 0013), so the one real
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
    if (def.burstsInto) names.add(def.burstsInto);
    if (def.groundFx) names.add(def.groundFx);
  }
  return [...names];
}

/** Every projectile an entity's states can fire, so the game loads those too. */
export function spawnsNamed(states: StatesFile | null | undefined): string[] {
  const names = new Set<string>();
  for (const def of Object.values(states?.states ?? {})) {
    if (def.fires) names.add(def.fires.spawn);
    for (const w of def.fires?.with ?? []) names.add(w.spawn);
  }
  return [...names];
}

export function validateStates(authored: StatesFile, anims: Record<string, AnimInfo>): Validation {
  // Types are checked as written; everything else as the engine will run it.
  const errors: string[] = hitTypeErrors(authored);
  const warnings: string[] = [];
  const file = withHitTypes(authored);
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

  if (file.onRelease !== undefined && !states[file.onRelease]) {
    errors.push(`onRelease state "${file.onRelease}" does not exist`);
  }

  for (const [name, def] of Object.entries(states)) {
    if (def.guard !== undefined && !states[def.guard]) {
      errors.push(`state "${name}": guard state "${def.guard}" does not exist`);
    }
  }

  // A block that does not block the way it already is stands the defender up
  // mid-string: the second blow of a blocked sequence arrives while they are
  // still in the first block, and a block naming no `guard` of its own falls
  // back to the file's. Found on 2026-08-22 by a crouching guard turning into
  // a standing one on the second hit.
  const blocks = new Set<string>(
    [file.onGuard, ...Object.values(states).map((d) => d.guard)].filter(
      (n): n is string => n !== undefined && n in states,
    ),
  );
  for (const name of blocks) {
    const covers = states[name].guard ?? file.onGuard;
    if (covers !== name) {
      warnings.push(
        `state "${name}" is a block, but blocking again from it goes to ` +
          `"${covers ?? "nothing"}" — a blocked string would change stance mid-way`,
      );
    }
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

    // Same shape as `ifAirborne`, and the same failure it exists to prevent:
    // a version that is not itself low stands the defender up on the frame it
    // starts, which is the whole thing being fixed.
    if (def.ifCrouching !== undefined) {
      const low = states[def.ifCrouching];
      if (!low) {
        errors.push(`${where}: ifCrouching "${def.ifCrouching}" is not a state`);
      } else if (!low.crouching) {
        warnings.push(
          `${where}: ifCrouching "${def.ifCrouching}" is not itself crouching — ` +
            `the next blow of a string would stand the defender up`,
        );
      }
    }

    if (def.hitstop !== undefined && (typeof def.hitstop !== "number" || def.hitstop < 0)) {
      errors.push(`${where}: "hitstop" must be a number of game frames, 0 or more`);
    }

    if (def.cancelBy !== undefined && (typeof def.cancelBy !== "number" || def.cancelBy < 0)) {
      errors.push(`${where}: "cancelBy" must be a frame of this state, 0 or more`);
    }
    if (def.loopEvery !== undefined && (typeof def.loopEvery !== "number" || def.loopEvery < 1)) {
      errors.push(`${where}: "loopEvery" must be a number of game frames, 1 or more`);
    }
    if (def.loopEvery !== undefined && def.loopSound === undefined) {
      warnings.push(`${where}: "loopEvery" with no "loopSound" — nothing is being repeated`);
    }
    if (def.ki !== undefined && typeof def.ki !== "number") {
      errors.push(`${where}: "ki" must be a number — gained per frame, spent when negative`);
    }
    if (def.rehit !== undefined && (typeof def.rehit !== "number" || def.rehit < 0)) {
      errors.push(`${where}: "rehit" must be a number of game frames, 0 or more`);
    }
    // A blow that may land twice and lifts twice spends the whole relaunch
    // budget on itself, and every hit after the second is refused outright.
    if (def.rehit !== undefined && def.relaunch) {
      warnings.push(`${where}: "rehit" with "relaunch" — the relaunch budget is gone after two hits`);
    }
    if (def.hitstun !== undefined && (typeof def.hitstun !== "number" || def.hitstun < 0)) {
      errors.push(`${where}: "hitstun" must be a number of game frames, 0 or more`);
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
    // A typed blow is already refused by hitTypeErrors, with a better message.
    const strikes = anim?.steps?.some((s) => s.boxes?.some((b) => b.type === "hit"));
    if (strikes && def.damage === undefined && def.type === undefined) {
      errors.push(`${where}: its animation has a hit box, so it needs "damage" — 0 for a blow that only moves`);
    }

    if (
      def.vel !== undefined &&
      (!Array.isArray(def.vel) || def.vel.length !== 2 || def.vel.some((v) => typeof v !== "number"))
    ) {
      errors.push(`${where}: "vel" must be two numbers, e.g. [0.83, 0]`);
    }
    if (
      def.velAt !== undefined &&
      (!Array.isArray(def.velAt) ||
        def.velAt.some((p, i) => !Array.isArray(p) || p.length !== 2 || p.some((v) => typeof v !== "number") ||
          (i > 0 && p[0] <= def.velAt![i - 1][0])))
    ) {
      errors.push(`${where}: "velAt" must be [frame, px per frame] pairs with the frames rising, e.g. [[14, 2.375]]`);
    }
    if (
      def.ball !== undefined &&
      (!Array.isArray(def.ball.at) || def.ball.at.length !== 2 || typeof def.ball.grow !== "number")
    ) {
      errors.push(`${where}: "ball" needs "at" as two numbers and "grow", e.g. { "at": [-10, -38], "grow": 2 }`);
    }
    if (
      def.band !== undefined &&
      (!Array.isArray(def.band.from) || typeof def.band.size !== "number" || typeof def.band.max !== "number")
    ) {
      errors.push(`${where}: "band" needs "from" as two numbers, "size" and "max"`);
    }
    const steps = anim?.steps?.length;
    if (def.holdStep !== undefined && (!Number.isInteger(def.holdStep) || def.holdStep < 0 || (steps !== undefined && def.holdStep >= steps))) {
      errors.push(`${where}: "holdStep" must be a step of its animation, 0 to ${(steps ?? 1) - 1}`);
    }
    if (
      def.shake !== undefined &&
      (!Number.isInteger(def.shake.pattern) || def.shake.pattern < 0 || def.shake.pattern >= SHAKE_PATTERNS ||
        !Number.isInteger(def.shake.frames) || def.shake.frames < 1)
    ) {
      errors.push(`${where}: "shake" needs "pattern" 0 to ${SHAKE_PATTERNS - 1} and "frames" 1 or more, e.g. { "pattern": 1, "frames": 8 }`);
    }
    if (def.shove !== undefined && typeof def.shove !== "number") {
      errors.push(`${where}: "shove" must be a number of px per frame, e.g. -3`);
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

    const rebound = def.rebound;
    if (rebound !== undefined && !(rebound.share > 0 && rebound.min > 0 && def.airborne)) {
      errors.push(`${where}: "rebound" needs a share and a min above 0, in an airborne state, e.g. { "share": 0.25, "min": 2 }`);
    }

    if (def.rank !== undefined && (typeof def.rank !== "number" || def.rank < 0)) {
      errors.push(`${where}: "rank" must be a number, 0 or more`);
    }

    if (def.relaunch !== undefined && typeof def.relaunch !== "boolean") {
      errors.push(`${where}: "relaunch" must be true or false`);
    }

    if (def.guarding !== undefined && typeof def.guarding !== "boolean") {
      errors.push(`${where}: "guarding" must be true or false`);
    }
    // What makes a combo a combo: a fighter a blow already holds cannot answer
    // the next one. All three scalings exist to end a sequence the victim cannot
    // escape, and a reaction that blocks would make every one escapable.
    if (def.guarding && (def.rank ?? 0) > 0) {
      errors.push(`${where}: a reaction (rank ${def.rank}) cannot be "guarding"`);
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

    // A relaunch is a blow allowed to lift a body twice, so one that cannot lift
    // at all is a line that does nothing — usually the flag put on the wrong
    // state of a pair, which is invisible until a juggle refuses to end.
    if (def.relaunch && def.onHit && !(states[def.onHit]?.launch || states[def.onHit]?.ifAirborne)) {
      warnings.push(
        `${where}: "relaunch" but its reaction "${def.onHit}" neither launches nor has an air version`,
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
        } else if (!(TRIGGERS as readonly string[]).includes(key) && !COUNTED.test(key)) {
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
    if (file.onRelease && states[file.onRelease]) roots.push(file.onRelease);
    for (const def of Object.values(states)) {
      if (def.onHit && states[def.onHit] && !roots.includes(def.onHit)) roots.push(def.onHit);
      // A stance's own block reaction is forced from outside like any other.
      if (def.guard && states[def.guard] && !roots.includes(def.guard)) roots.push(def.guard);
    }
    const seen = new Set<string>(roots);
    const queue = [...roots];
    for (let cur = queue.pop(); cur !== undefined; cur = queue.pop()) {
      const def = states[cur];
      // An air version is an edge, not a root: it is reached exactly when the
      // reaction that names it is, and no sooner.
      const next = (def?.transitions ?? []).map((t) => t.to);
      if (def?.ifAirborne) next.push(def.ifAirborne);
      if (def?.ifCrouching) next.push(def.ifCrouching);
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
