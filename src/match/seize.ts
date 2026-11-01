import type { ShakeDef } from "../camera/shake";
import type { Entity } from "../entity/entity";
import type { ScreenCue } from "../screen";
import { finaleStep, throwBall, type Finale } from "./finale";

/**
 * A state that takes the opponent out of the fight for a scene and gives him
 * back hurt — Saiyan Meteor's ae ($20:8A29). Unlike a throw (`throw.ts`, ADR
 * 0035) he is set down once and plays an animation of his own, and the scene
 * flies him rather than carries him: thrown up, bounced on the floor, left
 * lying until the blow that ends it. Frames are the original's: 0 is the
 * frame the state is entered on.
 */

/** A body the scene flies: sprite px, + down; `bounces` the vy left for the landings to come. */
export interface Flight {
  y: number;
  vy: number;
  bounces: readonly number[];
}

/**
 * One frame of the flight over a floor at `floor`: fall by `gravity`, and on
 * landing leave it again at the next bounce's vy — or stop, when none is left
 * ($20:8CCE: −3, then −1.5, then still).
 */
export function flightStep(f: Flight, gravity: number, floor: number): Flight & { landed: boolean; still: boolean } {
  const y = f.y + f.vy;
  if (f.vy < 0 || y < floor) return { y, vy: f.vy + gravity, bounces: f.bounces, landed: false, still: false };
  const [next, ...rest] = f.bounces;
  if (next === undefined) return { y: floor, vy: 0, bounces: [], landed: true, still: true };
  return { y: floor, vy: next, bounces: rest, landed: true, still: false };
}

/** What a frame of a scene asks of the world around the pair. */
export interface SeizeWorld {
  dust(x: number, y: number): void;
  effect(name: string, x: number, y: number): void;
  /** An effect somewhere on the screen, as the original picks a random spot ($0F:F284). */
  anywhere(name: string): void;
  screen(c: ScreenCue): void;
  shake(s: ShakeDef): void;
}

type Phase = "held" | "flying" | "lying" | "done";

interface Seizure {
  held: Entity;
  state: string;
  phase: Phase;
  vx: number;
  flight: Flight;
  /** Landings so far: which shake the next one starts. */
  landings: number;
  /** The ball thrown at him, once it is (`finale.ts`). */
  finale?: Finale;
}

/** The landings' shakes, in order: patterns 2, 1, 0 for 8 frames ($20:8D24, `8D54`, `8D85`). */
const LANDING_SHAKES = [2, 1, 0];

export class Seizures {
  private readonly seizing = new Map<Entity, Seizure>();

  /** After both bodies moved: the scene `seizer` is playing on `other`, if any. */
  update(seizer: Entity, other: Entity, world: SeizeWorld): void {
    const def = seizer.seize;
    const s = this.seizing.get(seizer);
    // the state's count is 1 on the frame it is entered: the move's frame is one less
    const frame = seizer.stateFrame - 1;
    if (s && (!def || seizer.state !== s.state)) {
      // cut short: let go where he is, as a throw cut short does
      if (s.phase !== "done") s.held.release();
      seizer.showThrownBall(null);
      this.seizing.delete(seizer);
      return;
    }
    if (!def) return;
    if (!s) {
      if (frame < def.at) return;
      other.hold(def.anim);
      // set down once, beside him, facing him ($20:8A78, $20:8A81)
      other.x = seizer.x + seizer.facing * def.place[0] * seizer.scaleOf;
      other.y = seizer.y + def.place[1] * seizer.scaleOf;
      other.facing = seizer.facing === 1 ? -1 : 1;
      this.seizing.set(seizer, { held: other, state: seizer.state, phase: "held", vx: 0, flight: { y: 0, vy: 0, bounces: [] }, landings: 0 });
      return;
    }
    const { held } = s;
    const scale = held.scaleOf;
    if (s.phase === "held" && frame >= def.launch.frame) {
      // thrown up and away from him, crying out ($20:8B6B, $20:8B74)
      const away = held.x >= seizer.x ? 1 : -1;
      s.vx = away * def.launch.vel[0];
      s.flight = { y: (held.y - held.floor) / scale, vy: def.launch.vel[1], bounces: def.bounces };
      held.sound("voice_hurt");
      s.phase = "flying";
    }
    if (s.phase === "flying") {
      const next = flightStep(s.flight, held.ownGravity, 0);
      s.flight = next;
      held.x += s.vx * scale;
      held.y = held.floor + next.y * scale;
      if (next.landed) {
        world.dust(held.x, held.floor);
        held.sound("land_2");
        world.shake({ pattern: LANDING_SHAKES[Math.min(s.landings, LANDING_SHAKES.length - 1)], frames: 8 });
        s.landings++;
      }
      if (next.still) s.phase = "lying";
    }
    const b = def.bursts;
    if (b && s.phase !== "done" && frame >= b.from && frame <= b.to && (frame - b.from) % b.every === 0) {
      world.effect(b.fx, held.x + held.facing * b.at[0] * scale, held.y + b.at[1] * scale);
    }
    const fin = def.finale;
    if (fin && s.phase !== "done") {
      if (!s.finale && frame >= fin.frame) {
        // from the hands at where he lies, its clock held while it flies ($20:8DC6)
        const [dx, dy] = fin.from;
        const from = { x: seizer.x + seizer.facing * dx * seizer.scaleOf, y: seizer.y + dy * seizer.scaleOf };
        s.finale = throwBall(fin, from.x, from.y, held.x, held.floor, seizer.scaleOf);
        seizer.holdClock(true);
        if (fin.sounds?.thrown) seizer.sound(fin.sounds.thrown);
      } else if (s.finale) {
        const [next, e] = finaleStep(s.finale, fin, held.floor);
        s.finale = next;
        if (e.landed) {
          if (fin.sounds?.landed) seizer.sound(fin.sounds.landed);
          world.shake(fin.shakes[0]);
          seizer.holdClock(false);
          seizer.jumpTo(fin.resume);
        }
        if (e.exploded) world.shake(fin.shakes[1]);
        if (e.white) {
          world.screen("white");
          world.shake(fin.shakes[2]);
        }
        if (e.burst) world.anywhere(fin.fx);
        if (e.done) {
          world.screen("restore");
          this.letGo(s, seizer, def.release);
        }
      }
      // the ball and the explosion are drawn by its thrower, in the world
      const f = s.finale;
      seizer.showThrownBall(f && (f.phase === "flying" || f.phase === "exploding") ? { x: f.x, y: f.y, radius: f.radius / seizer.scaleOf } : null);
      return;
    }
    if (s.phase !== "done" && frame >= def.release.frame) this.letGo(s, seizer, def.release);
  }

  /** The throw's own blow ($0F:B321): he faces the seizer's way, thrown backwards. */
  private letGo(s: Seizure, seizer: Entity, release: { damage: number; reaction: string; vel: [number, number] }): void {
    const { held } = s;
    held.facing = seizer.facing;
    held.hurtBy(release.damage);
    held.release(release.reaction, release.vel);
    s.phase = "done";
  }
}
