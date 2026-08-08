import { Container, Graphics, Sprite } from "pixi.js";
import type { Anim, EntityDef, Step } from "./entityDef";
import { StateMachine } from "./states";

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
}

export const NO_INPUT: WorldInput = { left: false, right: false };

const BOX_COLORS: Record<string, number> = {
  hit: 0xff3b3b,
  hurt: 0x4be04b,
  push: 0x4b9bff,
};

export class Entity {
  /** Ground position: x = world px, y = the ground line the anchor sits on. */
  x = 0;
  y = 0;
  /** +1 = facing right, −1 = facing left. */
  facing: 1 | -1 = 1;

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

  constructor(
    private readonly def: EntityDef,
    private readonly scale: number,
  ) {
    this.sprite.scale.set(scale);
    this.view.addChild(this.sprite, this.boxG);
    this.sm = def.states ? new StateMachine(def.states) : null;
    if (this.sm) this.setAnim(this.sm.def.anim);
    else this.setAnim(Object.keys(def.animations)[0] ?? "");
  }

  get state(): string {
    return this.sm?.current ?? this.animName;
  }

  /** Preview a single animation, bypassing the state machine (`?anim=`). */
  preview(name: string): void {
    this.previewing = true;
    this.setAnim(name);
  }

  /** Advance one game frame (60 FPS): facing, state, movement, animation. */
  update(input: WorldInput, opponentX: number | null, bounds: { min: number; max: number }): void {
    if (this.previewing) {
      this.advanceAnim();
      return;
    }
    if (!this.sm) return;

    // Facing is opponent-relative and only changes in states that allow it, so
    // an attack cannot turn around mid-swing.
    if (this.sm.def.turn && opponentX !== null && opponentX !== this.x) {
      this.facing = opponentX > this.x ? 1 : -1;
    }

    const fwd = this.facing > 0 ? input.right : input.left;
    const back = this.facing > 0 ? input.left : input.right;
    if (this.sm.update({ fwd, back }, this.animEnded)) this.setAnim(this.sm.def.anim);

    // Velocity is authored in sprite pixels, like box coordinates, and is
    // facing-relative (+ = forward); scaling to screen px happens here so the
    // data stays independent of SCALE. Velocity Y waits for gravity.
    const vx = (this.sm.def.vel?.[0] ?? 0) * this.scale;
    if (vx !== 0) this.x = Math.max(bounds.min, Math.min(bounds.max, this.x + this.facing * vx));

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
    for (const b of boxes) {
      // Mirror box X around the anchor when facing left.
      const bx = this.facing < 0 ? this.x - (b.x + b.w) * this.scale : this.x + b.x * this.scale;
      this.boxG
        .rect(bx, this.y + b.y * this.scale, b.w * this.scale, b.h * this.scale)
        .stroke({ color: BOX_COLORS[b.type] ?? 0xffffff, width: 1 });
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
