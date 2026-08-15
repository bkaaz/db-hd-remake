import { Container, Graphics, Sprite } from "pixi.js";
import type { Anim, Box, EntityDef, Step } from "./entityDef";
import { boxToWorld, type Placement } from "../combat/hit";
import { Audio } from "../audio/playback";
import { Combo } from "../combat/combo";
import { InputBuffer } from "../input/buffer";
import { DEFAULT_HIT_FX, reactionFor, StateMachine } from "./states";

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
   * The four attack buttons, by **strength** rather than by limb: which blow is
   * a punch and which a kick is the character's business, not the player's.
   * Each went down **this frame** (edge, not held).
   */
  light: boolean;
  medium: boolean;
  heavy: boolean;
  /** The ki blast, and the ender a chain falls into. */
  special: boolean;
}

export const NO_INPUT: WorldInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  light: false,
  medium: false,
  heavy: false,
  special: false,
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
  smash: boolean;
  /** Game frames the defender is held helpless for. */
  hitstun: number;
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
  combo: { hits: number; damage: number; lifts: number };
}

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

  /** Vertical velocity in sprite px per frame, negative upward. */
  private vy = 0;
  /** Horizontal velocity while airborne, facing-relative (momentum). */
  private vx = 0;
  /** Latched on touching the ground; cleared when the state changes. */
  private landed = false;
  /** Whether this entity was holding away from its opponent last frame. */
  private holdingBack = false;
  /**
   * Presses wait here for a few frames. Ticked below the freeze check, so a hit
   * pause cannot age a press out of existence — losing the input a player makes
   * *because* they saw the hit land is the one thing a buffer has to prevent.
   */
  private readonly buffer = new InputBuffer();
  /** The combo being done **to** this fighter — see src/combat/combo.ts. */
  readonly combo = new Combo();

  readonly view = new Container();
  private readonly sprite = new Sprite();
  private readonly boxG = new Graphics();

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
  private spent = false;

  private readonly gravity: number;
  private readonly landCue: number;
  private readonly pushWidth: number;
  private readonly hitstop: number;
  private readonly maxHealth: number;
  private readonly baseDamage: number;
  private readonly baseHitstun: number;
  /** What is left of this fighter, in health points. */
  private hp = 0;
  /** Game frames left of a hit pause; while it lasts nothing about the entity moves. */
  private freezeFrames = 0;
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
    this.pushWidth = def.attributes.pushWidth;
    this.hitstop = def.attributes.hitstop;
    this.maxHealth = def.attributes.health;
    this.baseDamage = def.attributes.damage;
    this.baseHitstun = def.attributes.hitstun;
    this.hp = this.maxHealth;
    this.sprite.scale.set(scale);
    this.view.addChild(this.sprite, this.boxG);
    this.sm = def.states ? new StateMachine(def.states) : null;
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
      hitConfirmed: this.spent,
      freeze: this.freezeFrames,
      stun: this.stun,
      hp: this.hp,
      vx: this.vx,
      buffer: this.buffer.live(),
      combo: { hits: this.combo.hits, damage: this.combo.damage, lifts: this.combo.lifts },
    };
  }

  /** Where this entity is, for placing authored boxes in the world. */
  get placement(): Placement {
    return { x: this.x, y: this.y, facing: this.facing, scale: this.scale };
  }

  /** Boxes of one type active on the current animation step. */
  boxes(type: Box["type"]): Box[] {
    return (this.currentStep()?.boxes ?? []).filter((b) => b.type === type);
  }

  /** True while this entity's current attack can still land. */
  get canHit(): boolean {
    return !this.spent;
  }

  /**
   * Whether blows pass straight through this entity right now — the floor, and
   * getting up off it. Rank already stops a blow interrupting a knockdown; this
   * is what stops it costing health while the victim can neither block nor move.
   */
  get invulnerable(): boolean {
    return !!this.sm?.def.invulnerable;
  }

  /** Record that the current attack connected; it cannot land again. */
  markHit(): void {
    this.spent = true;
  }

  /** The reaction this entity's current attack asks of whoever it hits. */
  get attackReaction(): string | undefined {
    return this.sm?.def.onHit;
  }

  /** Whether this entity's current attack may lift a body that is already helpless. */
  get attackSmash(): boolean {
    return !!this.sm?.def.smash;
  }

  /** Frames to freeze both fighters for when this entity's attack connects. */
  get attackHitstop(): number {
    return this.sm?.def.hitstop ?? this.hitstop;
  }

  /** Frames this entity's current attack holds whoever it hits. */
  get attackHitstun(): number {
    return this.sm?.def.hitstun ?? this.baseHitstun;
  }

  /**
   * Is this fighter blocking *right now*?
   *
   * There is no guard stance to stand in: holding away is already how you walk
   * backwards, so a blocking state would fight with `walk_back`. Instead the
   * block is decided at the moment of contact, which is also how the genre has
   * always worked — the guard pose only ever appears on a blow that arrives.
   * Not in the air: a fighter who can block a jump-in for free has removed the
   * point of jumping in.
   */
  get guarding(): boolean {
    return this.holdingBack && !this.airborne && !!this.def.states?.onGuard;
  }

  /** Sound this entity's current attack makes on landing, and on being blocked. */
  get attackSounds(): { hit?: string; block?: string } {
    return { hit: this.sm?.def.hitSound, block: this.sm?.def.blockSound };
  }

  /** Health this entity's current attack takes off. */
  get attackDamage(): number {
    return this.sm?.def.damage ?? this.baseDamage;
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
    const state = this.def.states?.onGuard;
    return state !== undefined && this.forceState(state);
  }

  /** Take damage. Health floors at zero; nothing happens there yet. */
  hurtBy(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    // Counted here rather than beside the reaction, because a blow that is
    // refused a reaction — a jab at someone already on the floor — still landed
    // and is still part of the combo.
    this.combo.hit(amount);
  }

  gotHit(blow: Blow): boolean {
    if (!this.def.states) return false;
    // A smash spends from a budget the combo owns, and the budget is checked
    // before the reaction is chosen: a blow past the limit is refused for the
    // same reason a jab at a floored fighter is, and looks the same from here.
    if (blow.smash && !this.combo.smashable) return false;
    const state = reactionFor(blow.reaction, this.def.states, this.sm?.def);
    if (state === undefined) return false;
    // Counted only now, because a reaction rank refused changed nothing.
    if (blow.smash) this.combo.smash();
    if (!this.forceState(state)) return false;
    // After entering, because arriving in a state clears the clock — and this
    // blow's hold is the one thing about the reaction the blow gets to decide.
    this.stun = blow.hitstun;
    return true;
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
    this.audio?.play(this.sm.def.sound);
    this.setAnim(this.sm.def.anim, forced);
    this.spent = false;
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
    const launch = this.sm.def.launch;
    if (launch) {
      // A null component keeps the axis: a bounce sets how high you come back
      // up without claiming to know how fast you were already travelling.
      if (launch[0] !== null) this.vx = launch[0];
      if (launch[1] !== null) this.vy = launch[1];
    }
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
    if (input.light) this.buffer.press("light");
    if (input.medium) this.buffer.press("medium");
    if (input.heavy) this.buffer.press("heavy");
    if (input.special) this.buffer.press("special");

    // A hit pause freezes the whole entity, animation included — the pose the
    // blow landed on is exactly what should be held still. The buffer is not
    // ticked below either, so the pause cannot age a press out of existence.
    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }

    if (this.stun > 0) this.stun--;

    // Facing is opponent-relative and only changes in states that allow it, so
    // an attack cannot turn around mid-swing.
    if (this.sm.def.turn && opponentX !== null && opponentX !== this.x) {
      this.facing = opponentX > this.x ? 1 : -1;
    }

    const fwd = this.facing > 0 ? input.right : input.left;
    const back = this.facing > 0 ? input.left : input.right;
    this.holdingBack = back;
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
        light: this.buffer.has("light"),
        medium: this.buffer.has("medium"),
        heavy: this.buffer.has("heavy"),
        special: this.buffer.has("special"),
      },
      {
        animEnded: this.animEnded,
        stunEnded: this.stun === 0,
        falling,
        nearGround,
        landed: this.landed,
        // `spent` means this attack has connected — set on a hit and on a block,
        // never on a whiff, which is exactly what a chain is allowed to continue
        // from. It was already recorded for a different reason: an attack may
        // only land once per entry into its state.
        hitConfirmed: this.spent,
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
        this.vy = 0;
        this.landed = true;
      }
    } else {
      this.y = this.groundY;
      this.x += this.facing * (this.sm.def.vel?.[0] ?? 0) * this.scale;
    }
    this.x = Math.max(bounds.min, Math.min(bounds.max, this.x));

    this.advanceAnim();
  }

  /** Push the simulation state into the display objects. */
  render(showBoxes: boolean): void {
    this.sprite.x = this.x;
    this.sprite.y = this.y;
    this.sprite.scale.x = this.facing * this.scale;

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
    this.applyFrame();
  }

  private applyFrame(): void {
    const step = this.currentStep();
    if (!step) return;
    const ft = this.def.frames.get(step.frame);
    if (!ft) return;
    this.sprite.texture = ft.tex;
    this.sprite.anchor.set(ft.anchor[0] / ft.w, ft.anchor[1] / ft.h);
  }

  private advanceAnim(): void {
    if (!this.anim || this.anim.steps.length === 0) return;
    this.remaining -= 1;
    if (this.remaining > 0) return;

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
    this.applyFrame();
  }
}
