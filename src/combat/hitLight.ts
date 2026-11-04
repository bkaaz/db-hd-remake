/**
 * Light a blow leaves where it lands, the original's `b1` effects set up by a
 * handler rather than a script (Gohan's `ae`, `$20:B624`, `$20:B558`). Its own
 * module because it outlives the state that struck and waits out the hit's
 * pause: the handler finds the spark only once the pause is over.
 */

/** What a state's blow lights: a ball at the spark, or a column of light through it. */
export type HitLightKind = "ball" | "pillar";

/** Kind 2, at the spark: 16 px, 2 more a frame, gone at 32 ($20:B682, $20:B45B). */
const BALL = { from: 16, grow: 2, gone: 32 };
/** Kind 4: 64 px wide, 2 less a side each frame, from the floor up ($20:B57F, $20:B5C0). */
const PILLAR = { half: 32, narrow: 2 };
/** 2 × `+0A`'s 0x6D lines round line 0x5C ($20:B5AF): to one past the floor, and out of the screen's top. */
export const PILLAR_HEIGHT = 218;

export class HitLight {
  private due: { kind: HitLightKind; x: number; y: number } | null = null;
  /** World x, y and the radius in sprite px; null with none up. */
  ball: { x: number; y: number; radius: number } | null = null;
  /** World x and the half-width in sprite px; null with none up. */
  pillar: { x: number; half: number } | null = null;

  /** A blow landed at x, y: lit on the first frame after its pause. */
  land(kind: HitLightKind, x: number, y: number): void {
    this.due = { kind, x, y };
  }

  /** One live frame: hit pauses do not count. */
  tick(): void {
    if (this.ball) {
      const radius = this.ball.radius + BALL.grow;
      this.ball = radius >= BALL.gone ? null : { ...this.ball, radius };
    }
    if (this.pillar) {
      const half = this.pillar.half - PILLAR.narrow;
      this.pillar = half <= 0 ? null : { ...this.pillar, half };
    }
    if (this.due?.kind === "ball") this.ball = { x: this.due.x, y: this.due.y, radius: BALL.from };
    if (this.due?.kind === "pillar") this.pillar = { x: this.due.x, half: PILLAR.half };
    this.due = null;
  }
}
