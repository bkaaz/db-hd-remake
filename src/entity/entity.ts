import { Container, Graphics, Sprite } from "pixi.js";
import type { Anim, Box, EntityDef, Step } from "./entityDef";
import { boxToWorld, type Placement } from "../combat/hit";
import { Audio } from "../audio/playback";
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
  /** Punch button went down **this frame** (edge, not held). */
  punch: boolean;
  /** Kick button went down **this frame** (edge, not held). */
  kick: boolean;
  /** Heavy punch button went down **this frame**. */
  punchHeavy: boolean;
  /** Heavy kick button went down **this frame**. */
  kickHeavy: boolean;
}

export const NO_INPUT: WorldInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  punch: false,
  kick: false,
  punchHeavy: false,
  kickHeavy: false,
};

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
  /** What is left of this fighter, in health points. */
  private hp = 0;
  /** Game frames left of a hit pause; while it lasts nothing about the entity moves. */
  private freezeFrames = 0;

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

  /** Off the ground — airborne fighters pass over each other instead of pushing. */
  get airborne(): boolean {
    return !!this.sm?.def.airborne;
  }

  /** Half the body's width in world px, for push collision. */
  get pushHalf(): number {
    return (this.pushWidth / 2) * this.scale;
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

  /** Record that the current attack connected; it cannot land again. */
  markHit(): void {
    this.spent = true;
  }

  /** The reaction this entity's current attack asks of whoever it hits. */
  get attackReaction(): string | undefined {
    return this.sm?.def.onHit;
  }

  /** Frames to freeze both fighters for when this entity's attack connects. */
  get attackHitstop(): number {
    return this.sm?.def.hitstop ?? this.hitstop;
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
  }

  gotHit(reaction: string | undefined): boolean {
    if (!this.def.states) return false;
    const state = reactionFor(reaction, this.def.states);
    return state !== undefined && this.forceState(state);
  }

  /** Enter a state because something happened *to* this entity (being hit). */
  forceState(name: string): boolean {
    if (!this.sm?.force(name)) return false;
    this.enterState();
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
  private enterState(): void {
    if (!this.sm) return;
    this.audio?.play(this.sm.def.sound);
    this.setAnim(this.sm.def.anim);
    this.spent = false;
    this.landed = false;
    // A launch is an impulse, applied once on entry; without one the entity
    // keeps whatever velocity it had, which is what carries a jump through its
    // take-off state into the airborne one.
    const launch = this.sm.def.launch;
    if (launch) {
      this.vx = launch[0];
      this.vy = launch[1];
    }
  }

  /**
   * Play a single animation and nothing else — no state machine, no physics.
   * Used by `?anim=` to inspect a move, and by effects, which *are* entities
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

    // A hit pause freezes the whole entity, animation included — the pose the
    // blow landed on is exactly what should be held still.
    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }

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
    // Edges go into the buffer; the state machine reads the buffer, not the edge.
    if (input.punch) this.buffer.press("punch");
    if (input.kick) this.buffer.press("kick");
    if (input.punchHeavy) this.buffer.press("punchHeavy");
    if (input.kickHeavy) this.buffer.press("kickHeavy");

    const airborne = !!this.sm.def.airborne;
    const falling = airborne && this.vy > 0;
    const nearGround = falling && this.groundY - this.y <= this.landCue * this.scale;

    const changed = this.sm.update(
      {
        fwd,
        back,
        up: input.up,
        down: input.down,
        punch: this.buffer.has("punch"),
        kick: this.buffer.has("kick"),
        punchHeavy: this.buffer.has("punchHeavy"),
        kickHeavy: this.buffer.has("kickHeavy"),
      },
      { animEnded: this.animEnded, falling, nearGround, landed: this.landed },
    );
    // A press that started a move is spent, so it cannot start a second one
    // when the move ends and the buffer has not expired yet.
    const fired = this.sm.lastFired;
    if (changed && fired?.startsWith("pressed:")) this.buffer.consume(fired.slice("pressed:".length));
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
        this.vy = 0;
        this.vx = 0;
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

  private setAnim(name: string): void {
    if (name === this.animName) return;
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
