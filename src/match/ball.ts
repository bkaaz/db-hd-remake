import type { Entity } from "../entity/entity";

/**
 * The ball a scene makes of the opponent — Gotenks's Volleyball, object 3/04 and
 * its shadow 3/0E ($0F:C13E). Separate from `seize.ts`, which owns the body: this
 * owns what flies in his place. Frames count from the scene's start.
 */

export interface SceneBallDef {
  fx: string;
  shadow: string;
  /** Px over his feet it starts at, and where the bubble closes on him. */
  above: number;
  /** The light closing on him: its first radius, and how long it lasts. */
  bubble: { size: number; frames: number };
  /** From this frame it is the ball, not the body going in. */
  shows: number;
  falls: number;
  gravity: number;
  /** The y it comes to rest at, and the vy of its one bounce. */
  floor: number;
  bounce: number;
  kick: { frame: number; vy: number };
  hang: number;
  ricochet: { frame: number; speed: number };
  /** The heights the shadow changes size at ($0F:C46B). */
  shadowAt: [number, number];
  burst: string;
  sound: string;
}

type Stage = "still" | "falling" | "flying" | "ricochet";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stage: Stage;
  bounced: boolean;
}

/** The ricochet's walls, from the screen's left and on the floor at 200 ($0F:C23C, `C252`). */
const NEAR_LEFT = 0x12;
const LEFT_AT = -3;
const NEAR_RIGHT = 0x14;
const RIGHT_AT = 0x101;
const SCREEN = 0x100;
const TOP = 0x3c;
const TOP_AT = 0x2c;
const BOTTOM = 0xac;
const BOTTOM_AT = 0xbc;

/** One frame of the ball; `hit` when it met a wall. `facing` sends it off, `left` is the screen's edge. */
export function ballStep(b: Ball, def: SceneBallDef, frame: number, facing: number, left: number): { ball: Ball; hit: boolean } {
  const n = { ...b };
  let hit = false;
  if (frame === def.falls) n.stage = "falling";
  if (frame === def.kick.frame) return { ball: { ...n, stage: "flying", vy: def.kick.vy }, hit };
  if (frame === def.hang) return { ball: { ...n, stage: "still", vy: 0 }, hit };
  if (frame === def.ricochet.frame) Object.assign(n, { stage: "ricochet", vx: facing * def.ricochet.speed, vy: def.ricochet.speed });
  if (n.stage === "falling" || n.stage === "flying") {
    n.vy += def.gravity;
    n.y += n.vy;
    if (n.stage === "falling" && n.y >= def.floor) {
      if (n.bounced) Object.assign(n, { stage: "still", y: def.floor, vy: 0 });
      else Object.assign(n, { bounced: true, vy: def.bounce });
    }
  }
  if (n.stage === "ricochet") {
    if (n.vx < 0 && n.x - left < NEAR_LEFT) [n.x, n.vx, hit] = [left + LEFT_AT, -n.vx, true];
    if (n.vx > 0 && left + SCREEN - n.x < NEAR_RIGHT) [n.x, n.vx, hit] = [left + RIGHT_AT, -n.vx, true];
    if (n.y < TOP) [n.y, n.vy, hit] = [TOP_AT, -n.vy, true];
    else if (n.y > BOTTOM) [n.y, n.vy, hit] = [BOTTOM_AT, -n.vy, true];
    n.x += n.vx;
    n.y += n.vy;
  }
  return { ball: n, hit };
}

/** The light's radius on `frame`, up by one a frame and back; none once it has closed. */
export function bubbleRadius(def: SceneBallDef, frame: number): number | null {
  const { size, frames } = def.bubble;
  return frame >= frames ? null : size + Math.min(frame, frames - 1 - frame);
}

/** Which of the shadow's three sizes a ball at `y` casts. */
export function shadowFrame(def: SceneBallDef, y: number): number {
  return y < def.shadowAt[0] ? 0 : y < def.shadowAt[1] ? 1 : 2;
}

export interface BallWorld {
  effect(name: string, x: number, y: number): Entity | null;
  drop(fx: Entity): void;
  /** The screen's left edge, as the original's `$0571` has it. */
  left(): number;
}

/** A ball on the screen: its two effects kept where `ballStep` says, and the bubble on the seizer's light. */
export class BallScene {
  private ball: Ball;
  private readonly fx: Entity | null;
  private readonly shadow: Entity | null;

  constructor(
    private readonly def: SceneBallDef,
    private readonly seizer: Entity,
    held: Entity,
    private readonly world: BallWorld,
  ) {
    this.ball = { x: held.x, y: held.y - def.above, vx: 0, vy: 0, stage: "still", bounced: false };
    this.fx = world.effect(def.fx, this.ball.x, this.ball.y);
    this.shadow = world.effect(def.shadow, this.ball.x, held.floor);
  }

  update(frame: number): void {
    const { def, seizer } = this;
    const { ball, hit } = ballStep(this.ball, def, frame, seizer.facing, this.world.left());
    this.ball = ball;
    if (hit) seizer.sound(def.sound);
    const radius = bubbleRadius(def, frame);
    seizer.showThrownBall(radius === null ? null : { x: ball.x, y: ball.y, radius });
    if (this.fx) [this.fx.x, this.fx.y] = [ball.x, ball.y];
    this.fx?.showFrame(frame < def.shows ? "0" : "1");
    if (this.shadow) this.shadow.x = ball.x;
    this.shadow?.showFrame(String(shadowFrame(def, ball.y)));
  }

  /** Gone in a burst; where it was is where he comes out. */
  end(): { x: number; y: number } {
    for (const fx of [this.fx, this.shadow]) if (fx) this.world.drop(fx);
    this.world.effect(this.def.burst, this.ball.x, this.ball.y);
    this.seizer.showThrownBall(null);
    return this.ball;
  }
}
