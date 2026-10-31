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

export class Throws {
  /** By thrower: whom he holds, in which state, and whether he has let go. */
  private readonly holding = new Map<Entity, { held: Entity; state: string; launched: boolean }>();

  /** After both bodies moved, before blows: the throw `thrower` is making of `other`, if any. */
  update(thrower: Entity, other: Entity): void {
    const grab = thrower.grab;
    const hold = this.holding.get(thrower);
    if (hold && (!grab || thrower.state !== hold.state)) {
      if (!hold.launched) hold.held.release();
      this.holding.delete(thrower);
      return;
    }
    if (!grab) return;
    if (!hold) {
      if (!other.throwable) return;
      // the move's own number names the held animation: m9d → m30_goku_9d
      other.hold(`m30_${thrower.name}_${thrower.animation.slice(1, 3)}`);
      // he turns to face the thrower ($20:8212)
      other.facing = thrower.facing === 1 ? -1 : 1;
      this.holding.set(thrower, { held: other, state: thrower.state, launched: false });
      return this.update(thrower, other);
    }
    if (hold.launched) return;
    const place = heldAt(grab.at[other.name], thrower.animStep, { ...thrower.placement, y: thrower.y });
    if (place) [other.x, other.y] = [place.x, place.y];
    // the state's count is 1 on the frame it is entered, the move's ($44) 0:
    // let go 20 frames after the throw began, as recorded (tools/re/log-throw.lua)
    if (thrower.stateFrame - 1 >= grab.launch.frame) {
      // he leaves facing the thrower's way, thrown backwards ($0F:B321, $20:8285)
      other.facing = thrower.facing;
      other.hurtBy(grab.launch.damage);
      other.release(grab.launch.reaction, grab.launch.vel);
      hold.launched = true;
    }
  }
}
