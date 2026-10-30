import { Container, Graphics, Sprite } from "pixi.js";
import type { Anim, Box, EntityDef, Step } from "./entityDef";
import { boxToWorld, type Placement } from "../combat/hit";
import { Audio } from "../audio/playback";
import { BALL_COLOUR, nextRadius } from "../combat/ball";
import { bandHeights, type BandDef } from "../combat/band";
import { reboundSpeed } from "../combat/rebound";
import { burnVariant } from "../combat/palettes";
import { Combo } from "../combat/combo";
import { withHitTypes } from "../combat/hitTypes";
import { Swing } from "../combat/swing";
import { slowed } from "../combat/knockback";
import { afterDefence } from "../combat/scaling";
import { InputBuffer } from "../input/buffer";
import { InputHistory, MOTION_NAMES } from "../input/history";
import { Motions } from "../input/motion";
import {
  DEFAULT_HIT_FX,
  groundSpeed,
  guardStateFor,
  reactionFor,
  StateMachine,
  type CloseButton,
  type StateDef,
} from "./states";

/**
 * One live entity in the world: sprite + animation playback + state machine +
 * position/facing. Several instances share one `EntityDef` (two Gokus are two
 * entities, one definition). Everything that runs per game frame for a fighter
 * lives here.
 */

/** Movement input in **world** terms; the entity maps it to forward/back. */
export interface WorldInput {
  left: boolean;
  right: boolean;
  up: boolean;
  /** Down arrow — held, like up. */
  down: boolean;
  /**
   * The buttons — Burst Limit's attack, guard, smash and ki blast (`blast`,
   * because `ki` is the meter), then the original's X (`strike`) and L/R
   * (`dash`). Each went down **this frame** (edge, not held).
   */
  attack: boolean;
  guard: boolean;
  smash: boolean;
  blast: boolean;
  strike: boolean;
  dash: boolean;
  /**
   * Whether each button is **still down**, which the edges above cannot say.
   * A stance you hold — charging ki on A+Z — needs it: two edges would have to
   * land on one frame, and whichever arrived alone would spend itself on a blow.
   */
holding: { attack: boolean; guard: boolean; smash: boolean; blast: boolean; strike: boolean; dash: boolean };
}

export const NO_INPUT: WorldInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  attack: false,
  guard: false,
  smash: false,
  blast: false,
  strike: false,
  dash: false,
  holding: { attack: false, guard: false, smash: false, blast: false, strike: false, dash: false },
};

/**
 * What a landing blow asks of the body taking it.
 *
 * One object rather than three arguments because they are one thing — the blow —
 * and every rule added since has wanted to travel with the others: what reaction
 * it forces, whether it may lift a body that is already helpless, and how long
 * it holds them.
 */
export interface Blow {
  /** The reaction the attacker's state names, if any; the defender's default otherwise. */
  reaction?: string;
  /** Whether it may lift or floor a body that is already helpless. */
  relaunch: boolean;
  /** Game frames the defender is held helpless for. */
  hitstun: number;
  /** Whether it sets the defender burning (`burns`). */
  burns?: boolean;
}

/** One fighter's innards, for the debug readout only — see `Entity.debug`. */
export interface EntityDebug {
  state: string;
  rank: number;
  step: number;
  steps: number;
  framesLeft: number;
  hitConfirmed: boolean;
  freeze: number;
  /** Game frames of helplessness left — the defender's half of a combo. */
  stun: number;
  hp: number;
  vx: number;
  buffer: [button: string, framesLeft: number][];
  /** The ki meter, in points. */
  ki: number;
  /** The last few inputs as the engine saw them — see input/history.ts. */
  inputs: string;
  /** Motions complete right now, so a recording can say when one landed. */
  motions: string[];
  combo: { hits: number; damage: number; lifts: number };
}

/** The button, not the key: nothing outside `input/keyboard.ts` knows which key is which. */
const ATTACK_LABELS = [
  ["attack", "A"],
  ["guard", "G"],
  ["smash", "S"],
  ["blast", "B"],
  ["strike", "K"],
  ["dash", "D"],
] as const satisfies readonly (readonly [keyof WorldInput, string])[];

/** Frames between copies of a retriggered sound when the state names no interval. */
const HUM_EVERY = 8;

const BOX_COLORS: Record<string, number> = {
  hit: 0xff3b3b,
  hurt: 0x4be04b,
  push: 0x4b9bff,
};

export class Entity {
  /** World x of the anchor, in screen px. */
  x = 0;
  /** The ground line this entity stands on; set by the world. */
  groundY = 0;
  /** Current y of the anchor — equal to `groundY` unless airborne. */
  y = 0;
  /** +1 = facing right, −1 = facing left. */
  facing: 1 | -1 = 1;
  /**
   * Whether this body's blows arrive from the direction it **travels** rather
   * than from where it stands. Set on a projectile and on nothing else.
   *
   * A fist is attached to a body, so the side a punch came from is the side its
   * owner is on — which is exactly what turns a defender round on a crossup. A
   * bolt is born in front of its thrower and has usually flown past the
   * victim's anchor by the time it connects, so its position is the wrong
   * answer and its heading is the right one.
   */
  travels = false;

  /** Vertical velocity in sprite px per frame, negative upward. */
  private vy = 0;
  /** Horizontal velocity while airborne, facing-relative (momentum). */
  private vx = 0;
  /** What is left of the shove the current state entered with — see `shove`. */
  private shove = 0;
  /** Frames the current state has moved for — what `velAt` is keyed by. */
  private stateFrames = 0;
  /** Latched on touching the ground; cleared when the state changes. */
  private landed = false;
  /** The speed the last fall hit the floor with — what a `rebound` goes back up at a share of. */
  private landedAt = 0;
  /**
   * Presses wait here for a few frames. Ticked below the freeze check, so a hit
   * pause cannot age a press out of existence — losing the input a player makes
   * *because* they saw the hit land is the one thing a buffer has to prevent.
   */
  private readonly buffer = new InputBuffer();
  /** What the stick has been doing, for the triggers a single frame cannot answer. */
  private readonly motions = new Motions();
  /** Scaffolding: the same inputs again, kept only so a person can read them. */
  private readonly history = new InputHistory();
  /** The combo being done **to** this fighter — see src/combat/combo.ts. */
  readonly combo: Combo;

  readonly view = new Container();
  private readonly sprite = new Sprite();
  private readonly boxG = new Graphics();
  /** The charging ball, added light over the fighter — see combat/ball.ts. */
  private readonly ballG = new Graphics();
  private ballRadius = 0;
  /** Where the ball was last held, so it shrinks in place once let go. */
  private ballAt: [number, number] = [0, 0];
  /** Where the head of the beam this entity threw has got to, world px — told by the bolts. */
  private beamHead: number | null = null;
  /** Frames the current state's band has been out — it thickens with them. */
  private bandFrames = 0;
  /** A band whose head is gone, thinning where it stood whatever state comes next. */
  private fading: { band: BandDef; frames: number; gone: number; head: number } | null = null;

  private readonly sm: StateMachine | null;
  /** Set by `preview()`: play one animation and ignore the state machine. */
  private previewing = false;

  private anim: Anim | null = null;
  private animName = "";
  private stepIndex = 0;
  private remaining = 0;
  /** Latched once a non-looping animation reaches its end (drives `animEnd`). */
  private animEnded = false;
  /**
   * Whether this entity's current attack already landed. An attack's hit box is
   * active for several frames, but it may only connect once per entry into the
   * state — cleared whenever the state changes.
   */
  /** The attack being thrown: whether it may connect, and whether it has. */
  private readonly swing = new Swing();

  private readonly gravity: number;
  private readonly landCue: number;
  private readonly closeRange: Partial<Record<CloseButton, number>>;
  private readonly pushWidth: number;
  private readonly hitstop: number;
  private readonly maxHealth: number;
  private readonly defence: number;
  private readonly maxKi: number;
  private readonly baseHitstun: number;
  /** What is left of this fighter, in health points. */
  private hp = 0;
  /** The ki meter. A separate pool from health — see combat.md. */
  private ki = 0;
  /** Set on entering a state that `fires`; taken by whoever owns projectiles. */
  private fired: StateDef["fires"] | null = null;
  /** The `groundFx` of the state just entered, until the fighters take it. */
  private groundFx: string | null = null;
  /** 0..1, filled by a state that charges and spent by what it throws. */
  private charge = 0;
  /**
   * How much bigger than authored this entity is drawn — a charged bolt comes
   * out large. It multiplies the drawing and the boxes, which are placed
   * through the same number, and **nothing else**: `scale` remains the world's
   * px per sprite px, so a big bolt is not also a fast one.
   */
  size = 1;
  /** How many things this entity has thrown that are still in the world. */
  private thrown = 0;
  /**
   * A sound retriggered while a state lasts — the charge hum. Id plus frames
   * until the next copy; a fresh `play` each time, so the copies overlap, which
   * is what makes a repeat sound like a sustain rather than a stutter.
   */
  private hum = { id: "", left: 0 };
  /** Game frames left of a hit pause; while it lasts nothing about the entity moves. */
  private freezeFrames = 0;
  /** Burning, and how far into the fire palettes — counted outside hitstop, as the original's is. */
  private burning = false;
  private burnFrame = 0;
  private shownVariant: string | null = null;
  /**
   * Game frames left of being held helpless by the last blow. Ticked below the
   * freeze check, like the buffer: a hit pause freezes both fighters equally, so
   * letting it eat hitstun would quietly change frame advantage — the one thing
   * a symmetric pause must not do.
   */
  private stun = 0;

  constructor(
    private readonly def: EntityDef,
    private readonly scale: number,
    private readonly audio: Audio | null = null,
  ) {
    this.gravity = def.attributes.gravity;
    this.landCue = def.attributes.landCue;
    this.closeRange = def.attributes.closeRange;
    this.pushWidth = def.attributes.pushWidth;
    this.hitstop = def.attributes.hitstop;
    this.maxHealth = def.attributes.health;
    this.defence = def.attributes.defence;
    this.combo = new Combo(def.attributes.comboLimits);
    this.maxKi = def.attributes.ki;
    this.baseHitstun = def.attributes.hitstun;
    this.hp = this.maxHealth;
    this.sprite.scale.set(scale);
    this.ballG.blendMode = "add";
    this.view.addChild(this.sprite, this.ballG, this.boxG);
    this.sm = def.states ? new StateMachine(withHitTypes(def.states), def.animations) : null;
    if (this.sm) this.setAnim(this.sm.def.anim);
    else this.setAnim(Object.keys(def.animations)[0] ?? "");
  }

  get state(): string {
    return this.sm?.current ?? this.animName;
  }

  /** Off the ground — a jump arcs over the opponent instead of being blocked. */
  get airborne(): boolean {
    return !!this.sm?.def.airborne;
  }

  /** Which buttons would pick their close version with the opponent at `opponentX`. */
  private closeTo(opponentX: number | null): Partial<Record<CloseButton, boolean>> {
    if (opponentX === null) return {};
    const gap = Math.abs(opponentX - this.x) / this.scale;
    const close: Partial<Record<CloseButton, boolean>> = {};
    for (const [button, range] of Object.entries(this.closeRange) as [CloseButton, number][]) {
      close[button] = gap < range;
    }
    return close;
  }

  /** Falling, and within `landCue` of the ground: the last stretch before touchdown. */
  get nearGround(): boolean {
    return this.airborne && this.vy > 0 && this.groundY - this.y <= this.landCue * this.scale;
  }

  /**
   * Whether this entity takes part in push collision.
   *
   * Standing on the ground, always. In the air only on the way down, once
   * `nearGround` — the same threshold that cues the landing pose. High up, two
   * bodies overlap freely, which is what makes jumping over someone possible;
   * near the floor they behave like the grounded bodies they are about to be.
   * Without that second half a fighter drops *through* the opponent and lands
   * on the far side, and the push that returns on touchdown arrives as a snap.
   */
  get solid(): boolean {
    return !this.airborne || this.nearGround;
  }

  /** Half the body's width in world px, for push collision. */
  get pushHalf(): number {
    return (this.pushWidth / 2) * this.scale;
  }

  /**
   * Everything the debug readout shows, in one place.
   *
   * Deliberately one getter rather than making six private fields public: this
   * exists for `src/ui/debug.ts` and nothing else, and it can be deleted in a
   * single edit when it stops earning its keep. Nothing in the game may read
   * it — if a rule needs one of these numbers, that number gets its own name.
   */
  get debug(): EntityDebug {
    return {
      state: this.state,
      rank: this.sm?.def.rank ?? 0,
      step: this.stepIndex,
      steps: this.anim?.steps.length ?? 0,
      framesLeft: this.remaining,
      hitConfirmed: this.swing.spent,
      freeze: this.freezeFrames,
      stun: this.stun,
      hp: this.hp,
      vx: this.vx,
      buffer: this.buffer.live(),
      ki: this.ki,
      inputs: this.history.line,
      motions: MOTION_NAMES.filter((m) => this.motions.has(m)),
      combo: { hits: this.combo.hits, damage: this.combo.damage, lifts: this.combo.lifts },
    };
  }

  /** Where this entity is, for placing authored boxes in the world. */
  get placement(): Placement {
    return { x: this.x, y: this.y, facing: this.facing, scale: this.scale * this.size };
  }

  /** Boxes of one type active on the current animation step. */
  boxes(type: Box["type"]): Box[] {
    return (this.currentStep()?.boxes ?? []).filter((b) => b.type === type);
  }

  /** True while this entity's current attack can still land. */
  get canHit(): boolean {
    return this.swing.canHit;
  }

  /**
   * Whether blows pass straight through this entity right now — the floor, and
   * getting up off it. Rank already stops a blow interrupting a knockdown; this
   * is what stops it costing health while the victim can neither block nor move.
   */
  get invulnerable(): boolean {
    return !!this.sm?.def.invulnerable;
  }

  /** The effect a state just entered puts on the floor under this entity, in world px — taken once. */
  takeGroundFx(): { name: string; x: number; y: number } | null {
    const name = this.groundFx;
    this.groundFx = null;
    return name ? { name, x: this.x, y: this.groundY } : null;
  }

  /**
   * The projectile this entity just launched, in world px, or null — and taking
   * it clears it, so one entry into a state fires one bolt however many frames
   * it lasts.
   */
  takeFired(): {
    spawn: string;
    state?: string;
    x: number;
    y: number;
    facing: 1 | -1;
    size: number;
    with: { spawn: string; x: number; y: number }[];
    /** Whether the thrower draws its band to this one — the state has a `band`. */
    beam: boolean;
  } | null {
    const fires = this.fired;
    if (!fires) return null;
    this.fired = null;
    this.thrown++;
    const [small, large] = fires.size ?? [1, 1];
    const size = small + (large - small) * this.charge;
    this.charge = 0;
    const placed = (at: [number, number]) => ({ x: this.x + this.facing * at[0] * this.scale, y: this.y + at[1] * this.scale });
    return {
      spawn: fires.spawn,
      state: fires.state,
      ...placed(fires.at),
      facing: this.facing,
      size,
      with: (fires.with ?? []).map((w) => ({ spawn: w.spawn, ...placed(w.at) })),
      beam: this.sm?.def.band !== undefined,
    };
  }

  /** Fill the ki meter — the debug key, and nothing in a fight does this. */
  fillKi(): void {
    this.ki = this.maxKi;
  }

  /** Where the head of what this entity threw has flown to; null once it is gone. */
  beamReaches(x: number | null): void {
    const band = this.sm?.def.band;
    if (x === null && band && this.beamHead !== null) {
      this.fading = { band, frames: this.bandFrames, gone: 0, head: this.beamHead };
    }
    if (x !== null) this.fading = null;
    this.beamHead = x;
  }

  /** One of the things this entity threw has left the world. */
  spawnEnded(): void {
    this.thrown = Math.max(0, this.thrown - 1);
  }

  /** Record that the current attack connected; it cannot land again. */
  markHit(): void {
    this.swing.hit(this.sm?.def.rehit);
  }

  /** The reaction this entity's current attack asks of whoever it hits. */
  get attackReaction(): string | undefined {
    return this.sm?.def.onHit;
  }

  /** Whether this entity's current attack may lift a body that is already helpless. */
  get attackRelaunch(): boolean {
    return !!this.sm?.def.relaunch;
  }

  /** Frames to freeze both fighters for when this entity's attack connects. */
  get attackHitstop(): number {
    return this.sm?.def.hitstop ?? this.hitstop;
  }

  /** Frames of white screen this entity's current attack asks for when it lands. */
  get attackFlash(): number {
    return this.sm?.def.hitFlash ?? 0;
  }

  /** Whether this entity's current attack sets whoever it hits burning. */
  get attackBurns(): boolean {
    return !!this.sm?.def.burns;
  }

  /** Frames this entity's current attack holds whoever it hits. */
  get attackHitstun(): number {
    return this.sm?.def.hitstun ?? this.baseHitstun;
  }

  /**
   * Is this fighter blocking *right now*? Only in a state marked `guarding` —
   * the stance the guard button holds, and the blockstun it leads to — and
   * never in the air: a fighter who can block a jump-in for free has removed
   * the point of jumping in.
   */
  get guarding(): boolean {
    return (
      !!this.sm?.def.guarding &&
      !this.airborne &&
      guardStateFor(this.sm?.def, this.def.states) !== undefined
    );
  }

  /** Sound this entity's current attack makes on landing, and on being blocked. */
  get attackSounds(): { hit?: string; block?: string } {
    return { hit: this.sm?.def.hitSound, block: this.sm?.def.blockSound };
  }

  /** Health this entity's current attack takes off. */
  get attackDamage(): number {
    return this.sm?.def.damage ?? 0;
  }

  /** How full the ki meter is, 0..1 — what the ki bar draws. */
  get kiFraction(): number {
    return this.maxKi > 0 ? this.ki / this.maxKi : 0;
  }

  /** How much of this fighter is left, 0..1 — what a health bar draws. */
  get healthFraction(): number {
    return this.maxHealth > 0 ? this.hp / this.maxHealth : 0;
  }

  /** True once there is nothing left. Round rules do not exist yet. */
  get defeated(): boolean {
    return this.hp <= 0;
  }

  /** Effect entity this entity's current attack leaves at the point of contact. */
  get attackFx(): string {
    return this.sm?.def.hitFx ?? DEFAULT_HIT_FX;
  }

  /** The effect this entity's blow becomes where it lands, if it is a projectile's (`burstsInto`). */
  get attackBurst(): string | undefined {
    return this.sm?.def.burstsInto;
  }

  /** Which step of its animation this entity is on — an effect's copies wait for one. */
  get animStep(): number {
    return this.stepIndex;
  }

  /**
   * Face whoever is at `x`. The one thing that turns a fighter outside a
   * `turn: true` state, and it exists because knockback is facing-relative:
   * no airborne state recomputes facing, so a fighter hit after crossing the
   * opponent would be thrown *toward* the blow. Turning them first makes every
   * reaction's negative `vx` mean "away" again, and stops the hurt animation
   * playing with their back to it.
   */
  turnToward(x: number): void {
    if (x === this.x) return;
    this.facing = x > this.x ? 1 : -1;
  }

  /**
   * Turn away from a blow **travelling** in `dir` — the same job as
   * `turnToward` for something that has flown past you. See `travels`.
   */
  turnFrom(dir: 1 | -1): void {
    this.facing = dir < 0 ? 1 : -1;
  }

  /**
   * Stop dead for `frames` game frames: no state changes, no movement, no
   * animation. The pause on a connecting hit, applied to both fighters so they
   * stick together for a moment instead of one sliding out of the other.
   */
  freeze(frames: number): void {
    if (frames > this.freezeFrames) this.freezeFrames = frames;
  }

  /** Mid hit pause — nothing about this entity may move, push included. */
  get frozen(): boolean {
    return this.freezeFrames > 0;
  }

  /**
   * Take a blow: enter the reaction the attacker asked for, or this entity's
   * own default. Returns false when neither names a state that exists — the
   * hit still landed, it just has nothing to show for it.
   */
  /** Enter this entity's block reaction. False when it cannot block at all. */
  guardHit(): boolean {
    const state = guardStateFor(this.sm?.def, this.def.states);
    return state !== undefined && this.forceState(state);
  }

  /**
   * Take damage, less this fighter's defence and **scaled by how long this
   * combo has already run**, and return what it actually cost. The caller
   * reports that number rather than the one it asked for: a log or a hit
   * counter showing the unscaled figure would be describing a blow nobody took.
   *
   * Health floors at zero; nothing happens there yet.
   */
  hurtBy(amount: number): number {
    const dealt = this.combo.worth(afterDefence(amount, this.defence));
    this.hp = Math.max(0, this.hp - dealt);
    // Counted here rather than beside the reaction, because a blow that is
    // refused a reaction — a jab at someone already on the floor — still landed
    // and is still part of the combo.
    this.combo.hit(dealt);
    return dealt;
  }

  gotHit(blow: Blow): boolean {
    if (!this.def.states) return false;
    // A relaunch spends from a budget the combo owns, and the budget is checked
    // before the reaction is chosen: a blow past the limit is refused for the
    // same reason a jab at a floored fighter is, and looks the same from here.
    if (blow.relaunch && !this.combo.canRelaunch) return false;
    const state = reactionFor(blow.reaction, this.def.states, this.sm?.def);
    if (state === undefined) return false;
    // Read before entering anything: arriving in a state can reset the combo,
    // and the hold this blow earns is decided by the beating up to it.
    const stun = this.combo.hold(blow.hitstun);
    // Counted only now, because a reaction rank refused changed nothing.
    if (blow.relaunch) this.combo.relaunch();
    if (!this.forceState(state)) return false;
    // After entering, because arriving in a state clears the clock — and this
    // blow's hold is the one thing about the reaction the blow gets to decide.
    this.stun = stun;
    if (blow.burns && this.def.attributes.burn.length > 0) {
      this.burning = true;
      // the original's counter is the game's, shared: where in the fire a burn
      // starts is no fact about the blow, so it starts anywhere
      this.burnFrame = Math.floor(Math.random() * 2 * this.def.attributes.burn.length);
      this.showVariant();
    }
    return true;
  }

  /** Draw the current frame from the fire palette burning is on, or from the own sheet. */
  private showVariant(): void {
    const variant = this.burning ? (burnVariant(this.def.attributes.burn, this.burnFrame) ?? null) : null;
    if (variant === this.shownVariant) return;
    this.shownVariant = variant;
    this.applyFrame();
  }

  /** Enter a state because something happened *to* this entity (being hit). */
  forceState(name: string): boolean {
    if (!this.sm?.force(name)) return false;
    this.enterState(true);
    return true;
  }

  /**
   * Everything that happens on arriving in a state, wherever the entity came
   * from. Both routes in — a transition it chose, and a reaction forced on it —
   * must run this, or a state means different things depending on how you got
   * there. That asymmetry is what stopped a knockdown ever leaving the ground:
   * its `launch` was applied only on the transition path, and a knockdown is
   * never transitioned into.
   */
  private enterState(forced = false): void {
    if (!this.sm) return;
    const sounds = this.sm.def.sound;
    for (const id of typeof sounds === "string" ? [sounds] : (sounds ?? [])) {
      this.audio?.play(id);
    }
    // Handed over rather than restarted when the next state names the same one:
    // resetting the clock would put an audible hitch at the seam.
    const wanted = this.sm.def.loopSound ?? "";
    if (wanted !== this.hum.id) this.hum = { id: wanted, left: 0 };
    this.setAnim(this.sm.def.anim, forced);
    this.swing.reset();
    this.landed = false;
    // A state arrives with no hold of its own; only a blow can set one, and it
    // does so straight after forcing the reaction.
    this.stun = 0;
    // Rank 0 is anything that is not a reaction, so arriving in one is the
    // fighter getting themselves back — which is exactly when a combo ends.
    this.combo.enter(this.sm.def.rank ?? 0);
    // A launch is an impulse, applied once on entry; without one the entity
    // keeps whatever velocity it had, which is what carries a jump through its
    // take-off state into the airborne one.
    this.ki = Math.max(0, this.ki - (this.sm.def.cost ?? 0));
    // A charge survives exactly one hop — into the state that throws it. Any
    // other state clears it, so a charge interrupted by a blow is not still
    // sitting there for the next move that happens to fire something.
    if (!this.sm.def.fires) this.charge = 0;
    // Latched rather than spawned here: what a bolt is allowed to hit is a fact
    // about the pair, so the thing between the fighters takes it off the latch.
    this.fired = this.sm.def.fires ?? null;
    this.groundFx = this.sm.def.groundFx ?? null;
    this.shove = this.sm.def.shove ?? 0;
    this.stateFrames = 0;
    // the shot takes the ball: the original's beam effect replaces it outright
    if (this.sm.def.fires) this.ballRadius = 0;
    const launch = this.sm.def.launch;
    if (launch) {
      // A null component keeps the axis: a bounce sets how high you come back
      // up without claiming to know how fast you were already travelling.
      if (launch[0] !== null) this.vx = launch[0];
      if (launch[1] !== null) this.vy = launch[1];
    }
    const rebound = this.sm.def.rebound;
    if (rebound) this.vy = reboundSpeed(rebound, this.landedAt);
  }

  /**
   * Play a single animation and nothing else — no state machine, no physics.
   * Used by the character select and by effects, which *are* entities
   * with no states: one animation, played once, then gone.
   */
  preview(name: string): void {
    this.previewing = true;
    this.setAnim(name);
  }

  /** Where a spawn goes once its bolt is gone (`onRelease`), if anywhere. */
  get releaseState(): string | undefined {
    return this.def.states?.onRelease;
  }

  /** A non-looping animation has reached its end — for effects, time to go. */
  get finished(): boolean {
    return this.animEnded;
  }

  /** Advance one game frame (60 FPS): facing, state, movement, animation. */
  update(input: WorldInput, opponentX: number | null, bounds: { min: number; max: number }): void {
    if (this.previewing) {
      this.advanceAnim();
      return;
    }
    if (!this.sm) return;

    // Edges go into the buffer; the state machine reads the buffer, not the
    // edge. This happens **above** the freeze check on purpose: a hit pause is
    // exactly when a player, having just seen the blow land, reaches for the
    // next attack, and an entity that returns before looking at its input
    // throws that press away. The buffer cannot keep what it is never handed.
    if (input.attack) this.buffer.press("attack");
    if (input.guard) this.buffer.press("guard");
    if (input.smash) this.buffer.press("smash");
    if (input.blast) this.buffer.press("blast");
    if (input.strike) this.buffer.press("strike");
    if (input.dash) this.buffer.press("dash");

    // A hit pause freezes the whole entity, animation included — the pose the
    // blow landed on is exactly what should be held still. The buffer is not
    // ticked below either, so the pause cannot age a press out of existence.
    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }
    if (this.burning) this.burnFrame++;
    this.showVariant();

    if (this.stun > 0) this.stun--;
    // Below the freeze check with the stun clock: a hit pause freezes both
    // fighters equally and must not decide when the next hit of a multi-hit
    // move arrives.
    this.swing.tick();
    if (this.hum.id) {
      if (this.hum.left <= 0) {
        this.audio?.play(this.hum.id);
        this.hum.left = this.sm.def.loopEvery ?? HUM_EVERY;
      }
      this.hum.left--;
    }
    // Below the freeze with every other clock: a hit pause must not pay anybody.
    const fill = this.sm.def.charge;
    if (fill) this.charge = Math.min(1, this.charge + 1 / fill);
    const perFrame = this.sm.def.ki;
    if (perFrame) this.ki = Math.max(0, Math.min(this.maxKi, this.ki + perFrame));

    // Facing is opponent-relative and only changes in states that allow it, so
    // an attack cannot turn around mid-swing.
    if (this.sm.def.turn && opponentX !== null && opponentX !== this.x) {
      this.facing = opponentX > this.x ? 1 : -1;
    }

    const fwd = this.facing > 0 ? input.right : input.left;
    const back = this.facing > 0 ? input.left : input.right;
    // Below the freeze check, like the buffer's tick: a hit pause must not age
    // a motion out of existence either. Facing-relative, so turning around does
    // not turn a quarter circle into its mirror mid-input.
    const stick = { fwd, back, up: input.up, down: input.down };
    this.motions.push(stick);
    this.history.record(
      stick,
      ATTACK_LABELS.filter(([button]) => input[button]).map(([, label]) => label),
      MOTION_NAMES.filter((m) => this.motions.has(m)),
    );
    // Live conditions, not latches: true only while they hold. `falling` turns
    // on at the apex; `nearGround` narrows that to the last stretch before
    // touchdown, where the landing pose belongs.
    const falling = this.airborne && this.vy > 0;
    const nearGround = this.nearGround;

    const changed = this.sm.update(
      {
        fwd,
        back,
        up: input.up,
        down: input.down,
        attack: this.buffer.has("attack"),
        guard: this.buffer.has("guard"),
        smash: this.buffer.has("smash"),
        blast: this.buffer.has("blast"),
        strike: this.buffer.has("strike"),
        dash: this.buffer.has("dash"),
        qcf: this.motions.has("qcf"),
        qcb: this.motions.has("qcb"),
        hcf: this.motions.has("hcf"),
        dbf: this.motions.has("dbf"),
        holding: input.holding,
      },
      {
        animEnded: this.animEnded,
        stunEnded: this.stun === 0,
        falling,
        nearGround,
        landed: this.landed,
        close: this.closeTo(opponentX),
        // `spent` means this attack has connected — set on a hit and on a block,
        // never on a whiff, which is exactly what a chain is allowed to continue
        // from. It was already recorded for a different reason: an attack may
        // only land once per entry into its state.
        hitConfirmed: this.swing.spent,
        ki: this.ki,
        spawnEnded: this.thrown === 0,
        charged: this.charge >= 1,
      },
    );
    // A press that started a move is spent, so it cannot start a second one
    // when the move ends and the buffer has not expired yet.
    if (changed && this.sm.pressSpent) this.buffer.consume(this.sm.pressSpent);
    if (changed) this.enterState();
    this.buffer.tick();

    // Velocities are authored in sprite pixels, like box coordinates, and X is
    // facing-relative (+ = forward); scaling to screen px happens here so the
    // data stays independent of SCALE.
    if (this.sm.def.airborne) {
      this.x += this.facing * this.vx * this.scale;
      this.y += this.vy * this.scale;
      this.vy += this.gravity;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        // Only the fall stops. Touching the ground does not delete horizontal
        // speed — a body skidding at 4.5 px a frame is still skidding — and
        // pretending it does made every bounce start from nothing, so the state
        // that followed had to invent a speed it could not know.
        this.landedAt = this.vy;
        this.vy = 0;
        this.landed = true;
        // the fire goes out when the body lands, its own palette back ($0D:CB47)
        this.burning = false;
      }
    } else {
      this.y = this.groundY;
      this.x += this.facing * (groundSpeed(this.sm.def, this.stateFrames) + this.shove) * this.scale;
      this.shove = slowed(this.shove);
    }
    this.x = Math.max(bounds.min, Math.min(bounds.max, this.x));
    const ball = this.sm.def.ball;
    if (ball) this.ballAt = ball.at;
    this.ballRadius = nextRadius(this.ballRadius, ball, this.stateFrames);
    this.bandFrames = this.sm.def.band && this.beamHead !== null ? this.bandFrames + 1 : 0;
    if (this.fading) {
      this.fading.gone++;
      const { band, frames, gone } = this.fading;
      if (bandHeights(band, frames, gone).head === 0) this.fading = null;
    }
    this.stateFrames++;

    this.advanceAnim();
  }

  /** Push the simulation state into the display objects. */
  render(showBoxes: boolean): void {
    this.sprite.x = this.x;
    this.sprite.y = this.y;
    this.sprite.scale.set(this.facing * this.scale * this.size, this.scale * this.size);

    this.ballG.clear();
    if (this.ballRadius > 0) {
      const [dx, dy] = this.ballAt;
      const k = this.scale * this.size;
      this.ballG.circle(this.x + this.facing * dx * k, this.y + dy * k, this.ballRadius * k).fill(BALL_COLOUR);
    }
    const band = this.sm?.def.band;
    if (band && this.beamHead !== null) this.drawBand(band, this.bandFrames, 0, this.beamHead);
    else if (this.fading) this.drawBand(this.fading.band, this.fading.frames, this.fading.gone, this.fading.head);

    this.boxG.clear();
    const boxes = showBoxes ? this.currentStep()?.boxes : undefined;
    if (!boxes) return;
    // Same conversion the collision uses, so the overlay shows what actually hits.
    const at = this.placement;
    for (const b of boxes) {
      const r = boxToWorld(b, at);
      this.boxG.rect(r.x, r.y, r.w, r.h).stroke({ color: BOX_COLORS[b.type] ?? 0xffffff, width: 1 });
    }
  }

  private drawBand(band: BandDef, frames: number, gone: number, head: number): void {
    const k = this.scale * this.size;
    const base = this.x + this.facing * band.from[0] * k;
    const y = this.y + band.from[1] * k;
    const h = bandHeights(band, frames, gone);
    const [b, t] = [(h.base * k) / 2, (h.head * k) / 2];
    this.ballG.poly([base, y - b, head, y - t, head, y + t, base, y + b]).fill(BALL_COLOUR);
  }

  // --- animation playback --------------------------------------------------

  private currentStep(): Step | null {
    if (!this.anim || this.anim.steps.length === 0) return null;
    return this.anim.steps[Math.min(this.stepIndex, this.anim.steps.length - 1)];
  }

  private setAnim(name: string, restart = false): void {
    // The guard is what lets walk_fwd → walk_back keep one cycle running rather
    // than stutter. `restart` is for the opposite case: being hit again while
    // already reeling has to play the reaction from the top, or the second blow
    // silently fails to refresh how long the defender is helpless.
    if (name === this.animName && !restart) return;
    const anim = this.def.animations[name];
    if (!anim) {
      console.warn(`[entity] unknown animation "${name}"`);
      return;
    }
    this.animName = name;
    this.anim = anim;
    this.stepIndex = 0;
    this.animEnded = false;
    this.remaining = Math.max(1, anim.steps[0]?.dur ?? 1);
    this.stepBegins();
  }

  private applyFrame(): void {
    const step = this.currentStep();
    if (!step) return;
    const ft = this.def.frames.get(step.frame);
    if (!ft) return;
    const variant = this.shownVariant ? this.def.variants.get(this.shownVariant)?.get(step.frame) : undefined;
    this.sprite.texture = variant ?? ft.tex;
    this.sprite.anchor.set(ft.anchor[0] / ft.w, ft.anchor[1] / ft.h);
  }

  private advanceAnim(): void {
    if (!this.anim || this.anim.steps.length === 0) return;
    this.remaining -= 1;
    if (this.remaining > 0) return;
    if (this.sm?.def.holdStep === this.stepIndex) return;

    this.stepIndex += 1;
    if (this.stepIndex >= this.anim.steps.length) {
      if (this.anim.loop) {
        this.stepIndex = 0;
      } else {
        this.stepIndex = this.anim.steps.length - 1;
        this.animEnded = true;
      }
    }
    this.remaining = Math.max(1, this.currentStep()?.dur ?? 1);
    // A held last step is not a new one beginning: its sound has played.
    if (!this.animEnded) this.stepBegins();
    else this.applyFrame();
  }

  private stepBegins(): void {
    this.applyFrame();
    const step = this.currentStep();
    for (const id of step?.sfx ?? []) this.audio?.playRom(id);
    if (step?.voice !== undefined) this.audio?.playLine(step.voice);
  }
}
