import type { Entity } from "../entity/entity";
import { finaleStep, throwBall, type Finale, type FinaleDef } from "./finale";
import type { SeizeWorld } from "./seize";

/**
 * A finale on a state of its own (ADR 0058): the opponent is not held, and
 * the ball goes on through the thrower's next states until the white is
 * gone, telling him as it lands and as it ends — the states wait on that,
 * as Galactic Gunfire's handler holds its frame ($20:9E57, $20:9F13).
 * Saiyan Meteor's finale belongs to its seize (`seize.ts`), which also flies
 * the opponent.
 */
export class Finales {
  /** By thrower: the ball, and the def it was thrown by — the state that threw it is long gone. */
  private readonly running = new Map<Entity, { ball: Finale; def: FinaleDef }>();

  /** After both bodies moved: the finale `thrower` is playing, if any. */
  update(thrower: Entity, other: Entity, world: SeizeWorld): void {
    const running = this.running.get(thrower);
    const def = running?.def ?? thrower.finale;
    if (!def) return;
    if (!running) {
      // the state's count is 1 on the frame it is entered: the move's frame is one less
      if (thrower.stateFrame - 1 < def.frame) return;
      const [dx, dy] = def.from;
      const x = thrower.x + thrower.facing * dx * thrower.scaleOf;
      const y = thrower.y + dy * thrower.scaleOf;
      this.running.set(thrower, { ball: throwBall(def, x, y, other.x, thrower.floor, thrower.scaleOf), def });
      if (def.sounds?.thrown) thrower.sound(def.sounds.thrown);
    } else {
      const [ball, e] = finaleStep(running.ball, def, thrower.floor);
      this.running.set(thrower, { ball, def });
      if (e.landed) {
        if (def.sounds?.landed) thrower.sound(def.sounds.landed);
        if (def.shakes[0]) world.shake(def.shakes[0]);
        thrower.finaleSays("ballLanded");
      }
      if (e.exploded) world.shake(def.shakes[1]);
      if (e.white) {
        world.screen("white");
        world.shake(def.shakes[2]);
      }
      if (e.burst) world.anywhere(def.fx);
      if (e.toll && def.sounds?.white) thrower.sound(def.sounds.white);
      if (e.done) {
        world.screen("restore");
        thrower.finaleSays("finaleDone");
        this.running.delete(thrower);
      }
    }
    // the ball and the explosion are drawn by its thrower, in the world
    const f = this.running.get(thrower)?.ball;
    thrower.showThrownBall(f && (f.phase === "flying" || f.phase === "exploding") ? { x: f.x, y: f.y, radius: f.radius / thrower.scaleOf } : null);
    thrower.showFloorBand(f && f.band > 0 ? { y: thrower.floor, size: f.band } : null);
  }
}
