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
  kick: { vy: number };
  ricochet: { speed: number };
  /** The seizer's states it answers: he leaves `scene` when it rests, and each sets it off or waits on it. */
  states: { scene: string; run: string; kick: string; hang: string; strike: string; land: string; after: string };
  /** How near he must rise to it, and from which frame of `kick` he is rising ($20:BFC8). */
  reach: number;
  leapFrom: number;
  /** Frames he watches it from landing, 15 more at most ($20:C01B). */
  watch: number;
  /** How far inside the screen it must be for him to end it ($20:C07F). */
  inside: number;
  /** What his blows leave, ahead of him ($20 script: b0 at 32, −16). */
  spark: { fx: string; at: [number, number] };
  /** The heights the shadow changes size at ($0F:C46B). */
  shadowAt: [number, number];
  burst: string;
  sound: string;
  /** Frames of white as it ends. */
  flash: number;
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

/** What the seizer does to the ball this frame. */
export type BallEvent = "kick" | "hang" | "strike";

/** One frame of the ball; `hit` when it met a wall. `facing` sends it off, `left` is the screen's edge. */
export function ballStep(b: Ball, def: SceneBallDef, frame: number, event: BallEvent | null, facing: number, left: number): { ball: Ball; hit: boolean } {
  const n = { ...b };
  let hit = false;
  if (frame === def.falls) n.stage = "falling";
  if (event === "kick") return { ball: { ...n, stage: "flying", vy: def.kick.vy }, hit };
  if (event === "hang") return { ball: { ...n, stage: "still", vy: 0 }, hit };
  if (event === "strike") Object.assign(n, { stage: "ricochet", vx: facing * def.ricochet.speed, vy: def.ricochet.speed });
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
  flash(frames: number): void;
  /** The screen's left edge, as the original's `$0571` has it. */
  left(): number;
}

/** Well enough inside the screen to end it there. */
export function ballInside(b: Ball, def: SceneBallDef, left: number): boolean {
  const edge = def.inside;
  return b.x - left >= edge && left + SCREEN - b.x >= edge && b.y >= edge && b.y < BOTTOM_AT + 20;
}

/** A ball on the screen: its two effects kept where `ballStep` says, and the seizer's part in it. */
export class BallScene {
  private ball: Ball;
  private was = "";
  /** Frames left of his watching, once he has landed. */
  private watching: number | null = null;
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

  /** He has watched long enough and it can end where it is. */
  get done(): boolean {
    return this.watching === 0 && ballInside(this.ball, this.def, this.world.left());
  }

  /** Which event his state sets off this frame, moving him on where the ball decides. */
  private seizerPart(frame: number): BallEvent | null {
    const { seizer, ball } = this;
    const { states, reach, leapFrom, spark, watch } = this.def;
    const entered = seizer.state !== this.was;
    this.was = seizer.state;
    const blow = () => this.world.effect(spark.fx, seizer.x + seizer.facing * spark.at[0], seizer.y + spark.at[1]);
    if (seizer.state === states.scene && ball.stage === "still" && ball.bounced) seizer.forceState(states.run);
    if (entered && seizer.state === states.land) this.watching = watch + (frame & 15);
    else if (this.watching) this.watching--;
    if (entered && seizer.state === states.kick) {
      blow();
      return "kick";
    }
    if (seizer.state === states.kick && seizer.stateFrame > leapFrom && Math.abs(seizer.y - ball.y) < reach) {
      seizer.forceState(states.hang);
      return "hang";
    }
    if (entered && seizer.state === states.strike) {
      blow();
      return "strike";
    }
    return null;
  }

  update(frame: number): void {
    const { def, seizer } = this;
    const event = this.seizerPart(frame);
    const { ball, hit } = ballStep(this.ball, def, frame, event, seizer.facing, this.world.left());
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
    this.world.flash(this.def.flash);
    this.seizer.showThrownBall(null);
    this.seizer.forceState(this.def.states.after);
    return this.ball;
  }
}
