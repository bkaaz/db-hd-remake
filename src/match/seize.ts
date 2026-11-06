import { barAt, domeRadius, type SceneBar } from "./sceneLight";
import type { ShakeDef } from "../camera/shake";
import type { Entity } from "../entity/entity";
import type { SeizeDef } from "../entity/states";
import type { ScreenCue } from "../screen";
import { BallScene, type BallWorld } from "./ball";
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
export interface SeizeWorld extends BallWorld {
  dust(x: number, y: number): void;
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
  /** What flies in his place (`ball.ts`). */
  ball?: BallScene;
  /** Px a frame he is moved by, toward the seizer's facing and down (`steps`). */
  drift?: [number, number] | null;
  /** Where he is kept from the seizer, in the air or not (`steps`). */
  on?: [number, number] | null;
  /** Thrown once: a step's `lands` holds him again after it. */
  launched?: boolean;
  /** Where the dome stands: where he was as it began. */
  domeX?: number;
  /** Each bar's x, taken on its first frame: it stays when he leaves. */
  barsAt: Map<SceneBar, number>;
  /** The scene's frame, which goes on counting through its later states (`sceneOf`). */
  elapsed: number;
  /** Frames of a spark's pause still to wait. */
  paused?: number;
}

/** Where a let-go's explosion goes, over his feet: Oyatsu Kosen's `a/17` at y `C0`, recorded. */
const BURST_ABOVE = 8;

/** The circle a scene's `light` shows on `frame`, or null with none. */
export function lightOn(light: NonNullable<SeizeDef["light"]>, frame: number, held: { x: number; y: number }, scale: number): { x: number; y: number; radius: number } | null {
  const t = frame - light.from;
  if (t < 0) return null;
  const rising = light.top - light.start;
  const radius = t <= rising ? light.start + t : light.top - (t - rising);
  return radius > 0 ? { x: held.x + light.at[0] * scale, y: held.y + light.at[1] * scale, radius } : null;
}

/** The landings' shakes, in order: patterns 2, 1, 0 for 8 frames ($20:8D24, `8D54`, `8D85`). */
const LANDING_SHAKES = [2, 1, 0];

export class Seizures {
  private readonly seizing = new Map<Entity, Seizure>();

  /** After both bodies moved: the scene `seizer` is playing on `other`, if any. */
  update(seizer: Entity, other: Entity, world: SeizeWorld): void {
    const def = seizer.seize;
    const s = this.seizing.get(seizer);
    // a spark's pause holds the scene with the pair: nothing on its frame happens twice ($30B2)
    if (s?.paused && def) {
      s.paused--;
      return;
    }
    // the state's count is 1 on the frame it is entered: the move's frame is one less
    let frame = seizer.stateFrame - 1;
    if (s) s.elapsed = frame = seizer.state === s.state ? frame : s.elapsed + 1;
    if (s && !def) {
      // cut short: let go where he is, as a throw cut short does
      if (s.phase !== "done") {
        s.ball?.end();
        s.held.hide(false);
        s.held.release();
      }
      seizer.showThrownBall(null);
      seizer.showFloorBand(null);
      seizer.showBars([]);
      this.seizing.delete(seizer);
      return;
    }
    if (!def) return;
    if (!s) {
      if (frame < def.at) return;
      other.hold(def.anim);
      if (def.still) other.holdStill();
      // set down once, beside him, facing him ($20:8A78, $20:8A81)
      if (def.place) {
        other.x = seizer.x + seizer.facing * def.place[0] * seizer.scaleOf;
        other.y = seizer.y + def.place[1] * seizer.scaleOf;
      }
      other.facing = seizer.facing === 1 ? -1 : 1;
      if (def.cry) other.sound(def.cry);
      this.seizing.set(seizer, { held: other, state: seizer.state, phase: "held", vx: 0, flight: { y: 0, vy: 0, bounces: [] }, landings: 0, elapsed: frame, barsAt: new Map() });
      return;
    }
    const { held } = s;
    const scale = held.scaleOf;
    if (def.hides !== undefined && frame === def.hides) held.hide(true);
    for (const step of def.steps ?? []) {
      const due = step.every ? frame >= step.frame && (frame - step.frame) % step.every === 0 : frame === step.frame;
      if (due) this.playStep(s, seizer, step);
    }
    if (s.drift && s.phase === "held") {
      held.x += seizer.facing * s.drift[0] * scale;
      held.y = Math.min(held.floor, held.y + s.drift[1] * scale);
    }
    if (s.on && s.phase === "held") {
      held.x = seizer.x + seizer.facing * s.on[0] * scale;
      held.y = seizer.y + s.on[1] * scale;
    }
    for (const c of def.screens ?? []) if (c.frame === frame) world.screen(c.cue);
    for (const p of def.sparks ?? []) {
      if (p.frame !== frame) continue;
      world.effect("hit_spark", seizer.x + seizer.facing * p.at[0] * scale, seizer.y + p.at[1] * scale);
      if (p.sound) seizer.sound(p.sound);
      if (p.pause) {
        seizer.freeze(p.pause);
        held.freeze(p.pause);
        s.paused = p.pause;
      }
    }
    if (def.dome) {
      const radius = domeRadius(def.dome, frame);
      const start = def.dome.from;
      if (frame === start) s.domeX = held.x;
      seizer.showThrownBall(radius > 0 ? { x: s.domeX ?? held.x, y: held.floor, radius } : null);
    }
    if (def.bars) seizer.showBars(this.barsOn(s, def.bars, seizer, frame));
    if (def.light) seizer.showThrownBall(lightOn(def.light, frame, held, scale));
    if (def.ball && s.phase !== "done") {
      s.ball ??= new BallScene(def.ball, seizer, held, world);
      s.ball.update(frame);
    }
    if (s.phase === "held" && def.launch && !s.launched && frame >= def.launch.frame) {
      s.launched = true;
      if (def.launch.from) {
        held.x = seizer.x + seizer.facing * def.launch.from[0] * scale;
        held.y = seizer.y + def.launch.from[1] * scale;
        held.hide(false);
      }
      // thrown up and away from him, crying out ($20:8B6B, $20:8B74)
      const away = held.x >= seizer.x ? 1 : -1;
      s.vx = away * def.launch.vel[0];
      s.flight = { y: (held.y - held.floor) / scale, vy: def.launch.vel[1], bounces: def.bounces ?? [] };
      if (!def.launch.quiet) held.sound("voice_hurt");
      s.phase = "flying";
    }
    if (s.phase === "flying") {
      const next = flightStep(s.flight, held.ownGravity, 0);
      s.flight = next;
      held.x += s.vx * scale;
      held.y = held.floor + next.y * scale;
      if (next.landed) {
        world.dust(held.x, held.floor);
        held.sound("land_0d");
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
        s.finale = throwBall(fin, from.x, from.y, fin.sweep ? world.left() : held.x, held.floor, seizer.scaleOf);
        if (!fin.sweep) seizer.holdClock(true);
        if (fin.sounds?.thrown) seizer.sound(fin.sounds.thrown);
      } else if (s.finale) {
        const [next, e] = finaleStep(s.finale, fin, held.floor);
        s.finale = next;
        if (e.landed) {
          if (fin.sounds?.landed) seizer.sound(fin.sounds.landed);
          if (fin.shakes[0]) world.shake(fin.shakes[0]);
          seizer.holdClock(false);
          if (fin.resume !== undefined) seizer.jumpTo(fin.resume);
        }
        if (e.exploded) world.shake(fin.shakes[1]);
        if (e.white) {
          world.screen("white");
          world.shake(fin.shakes[2]);
        }
        if (e.burst) world.anywhere(fin.fx);
        if (e.toll && fin.sounds?.white) seizer.sound(fin.sounds.white);
        if (e.done) {
          world.screen("restore");
          this.letGo(s, seizer, def.release, world);
          seizer.finaleSays("finaleDone");
        }
      }
      // the ball and the explosion are drawn by its thrower, in the world
      const f = s.finale;
      seizer.showThrownBall(f && (f.phase === "flying" || f.phase === "exploding") ? { x: f.x, y: f.y, radius: f.radius / seizer.scaleOf } : null);
      seizer.showFloorBand(f && f.band > 0 ? { y: held.floor, size: f.band } : null);
      seizer.showSweep(f?.phase === "sweep" && fin.sweep ? { apex: [f.vy, f.y], x: f.x, half: fin.sweep.half, floor: held.floor } : null);
      return;
    }
    const over = s.ball ? s.ball.done : frame >= (def.release.frame ?? Infinity);
    if (s.phase !== "done" && over) this.letGo(s, seizer, def.release, world);
  }

  private playStep(s: Seizure, seizer: Entity, step: NonNullable<SeizeDef["steps"]>[number]): void {
    const { held } = s;
    if (step.anim) held.hold(step.anim);
    if (step.toHold) held.holdToScript();
    if (step.cry) held.sound(step.cry);
    if (step.sound) seizer.sound(step.sound);
    if (step.show !== undefined) held.jumpTo(step.show);
    if (step.draws) held.showDrawing(step.draws[held.name]);
    const at = step.atBy?.[held.name] ?? step.at;
    if (at) {
      held.x = seizer.x + seizer.facing * at[0] * held.scaleOf;
      held.y = held.floor + at[1] * held.scaleOf;
    }
    if (step.drift !== undefined) s.drift = step.drift;
    if (step.hide !== undefined) held.hide(step.hide);
    if (step.on !== undefined) s.on = step.on;
    if (step.lands) s.phase = "held";
  }

  private barsOn(s: Seizure, bars: SceneBar[], seizer: Entity, frame: number): { x: number; y: number; w: number; h: number }[] {
    const k = seizer.scaleOf;
    return bars.flatMap((bar) => {
      const at = barAt(bar, frame);
      if (!at) return [];
      if (!s.barsAt.has(bar)) s.barsAt.set(bar, (bar.on === "held" ? s.held : seizer).x);
      const x = s.barsAt.get(bar)!;
      const [a, b] = seizer.facing === 1 ? [at.left, at.right] : [-at.right, -at.left];
      return [{ x: x + a * k, y: s.held.floor + at.top * k, w: (b - a) * k, h: (at.bottom - at.top) * k }];
    });
  }

  /** The throw's own blow ($0F:B321): he faces the seizer's way, thrown backwards. */
  private letGo(s: Seizure, seizer: Entity, release: SeizeDef["release"], world: SeizeWorld): void {
    const { held } = s;
    if (s.ball) ({ x: held.x, y: held.y } = s.ball.end());
    held.hide(false);
    // an ordinary blow he takes facing it ($20:E2A7's), or thrown over his back
    held.facing = release.ahead ? (seizer.facing === 1 ? -1 : 1) : seizer.facing;
    held.hurtBy(release.damage);
    held.release(release.reaction, release.vel);
    if (release.burns) held.setBurning();
    if (release.fx) world.effect(release.fx, held.x, held.y - BURST_ABOVE * held.scaleOf);
    s.phase = "done";
  }
}
