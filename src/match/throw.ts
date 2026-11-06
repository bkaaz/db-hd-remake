import type { Entity } from "../entity/entity";

/**
 * One fighter's throw of the other, frame by frame (ADR 0035): taking hold
 * as the throw's state begins, putting the held one where the thrower's
 * step says, and letting him go with the launch — or where he stands, if
 * the throw is cut short. The pair is the thing that knows both bodies, so
 * this lives beside `blow.ts`, not in either entity.
 */

/** Where the thrower stands, as far as placing the held one goes. */
export interface Holder {
  x: number;
  y: number;
  facing: 1 | -1;
  scale: number;
}

/**
 * Where the held one goes: the offset for the thrower's step — the last one
 * past the table's end — dx toward the thrower's facing. Null with no table
 * for him: held where he stands.
 */
export function heldAt(at: readonly [number, number][] | undefined, step: number, by: Holder): { x: number; y: number } | null {
  if (!at?.length) return null;
  const [dx, dy] = at[Math.min(step, at.length - 1)];
  return { x: by.x + by.facing * dx * by.scale, y: by.y + dy * by.scale };
}

/** What a throw's launch may ask of the world around the pair. */
export interface ThrowWorld {
  effect(name: string, x: number, y: number): unknown;
  flash(frames: number): void;
}

export class Throws {
  /** By thrower: whom he holds, in which state, and whether he has let go. */
  private readonly holding = new Map<Entity, { held: Entity; state: string; launched: boolean; shocks: boolean }>();

  /** After both bodies moved, before blows: the throw `thrower` is making of `other`, if any. */
  update(thrower: Entity, other: Entity, world?: ThrowWorld): void {
    const grab = thrower.grab;
    const hold = this.holding.get(thrower);
    // handed on: the next state's grab keeps him, with no idle between (Piccolo's counters, then his throw)
    if (hold && !hold.launched && grab?.caught && thrower.state !== hold.state) {
      hold.state = thrower.state;
      hold.held.hold(`m30_${thrower.name}_${thrower.animation.slice(1, 3)}`);
    }
    if (hold && (!grab || thrower.state !== hold.state)) {
      if (!hold.launched) {
        if (hold.shocks) hold.held.shock(false);
        hold.held.release();
      }
      this.holding.delete(thrower);
      return;
    }
    if (!grab) return;
    if (!hold) {
      if (!grab.caught && !other.throwable) return;
      // the move's own number names the held animation: m9d → m30_goku_9d
      const held = `m30_${thrower.name}_${thrower.animation.slice(1, 3)}`;
      other.hold(grab.caught && other.y < other.groundY ? `${held}_air` : held);
      // he turns to face the thrower ($20:8212)
      other.facing = thrower.facing === 1 ? -1 : 1;
      this.holding.set(thrower, { held: other, state: thrower.state, launched: false, shocks: !!grab.shocks });
      return this.update(thrower, other, world);
    }
    if (hold.launched) return;
    if (grab.shocks) other.shock(true);
    const flipped = grab.flips && thrower.stateFrame - 1 >= grab.flips.frame;
    if (flipped) other.flipHeld(true);
    // the step past it is where the launch sets him down, never drawn upside down
    const step = grab.flips ? Math.min(thrower.animStep, grab.flips.step - (flipped ? 0 : 1)) : thrower.animStep;
    const place = heldAt(grab.at[other.name], step, { ...thrower.placement, y: thrower.y });
    if (place) [other.x, other.y] = [place.x, place.y];
    if (grab.lift) {
      const risen = Math.max(0, Math.min(thrower.stateFrame - grab.lift.from, grab.lift.px));
      other.y = (place?.y ?? other.groundY) - risen * thrower.placement.scale;
    }
    if (grab.turnsAt !== undefined && thrower.stateFrame - 1 >= grab.turnsAt) other.facing = thrower.facing;
    // the state's count is 1 on the frame it is entered, the move's ($44) 0:
    // let go 20 frames after the throw began, as recorded (tools/re/log-throw.lua)
    if (thrower.stateFrame - 1 >= grab.launch.frame) {
      // thrown backwards, as he faces: over the thrower's back facing his way ($20:8285),
      // or ahead of him, still facing him (`ahead`, Vegeta's) — $0F:B321's facing
      other.facing = grab.launch.ahead ? (thrower.facing === 1 ? -1 : 1) : thrower.facing;
      other.hurtBy(grab.launch.damage);
      if (grab.shocks) other.shock(false);
      const from = grab.flips && heldAt(grab.at[other.name], thrower.animStep, { ...thrower.placement, y: thrower.y });
      if (from) [other.x, other.y] = [from.x, from.y];
      if (grab.launch.stillCamera) other.keepCamera();
      const { scale, facing } = thrower.placement;
      for (const fx of grab.launch.fx ?? []) world?.effect(fx.name, thrower.x + facing * fx.at[0] * scale, thrower.y + fx.at[1] * scale);
      if (grab.launch.flash) world?.flash(grab.launch.flash);
      other.release(grab.launch.reaction, grab.launch.vel, grab.launch.quiet);
      hold.launched = true;
    }
  }
}

/**
 * The throw's own blow on the opponent wherever he is, held or not, on the
 * frame its state's `throwsFoe` names ($0F:B321) — Galactic Gunfire's on the
 * body it pinned. He faces the thrower's way, thrown backwards.
 */
export function throwFoe(thrower: Entity, other: Entity, effect: (name: string, x: number, y: number) => unknown): void {
  const t = thrower.throwsFoe;
  if (!t || thrower.stateFrame - 1 !== t.frame) return;
  other.facing = t.ahead ? (thrower.facing === 1 ? -1 : 1) : thrower.facing;
  other.hurtBy(t.damage);
  other.release(t.reaction, t.vel);
  if (!t.fx) return;
  const { scale, facing } = thrower.placement;
  effect(t.fx.name, other.x + facing * t.fx.at[0] * scale, other.y + t.fx.at[1] * scale);
}
