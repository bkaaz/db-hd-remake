import type { Bounds } from "../combat/push";
import { pushOf } from "./push";

/**
 * The camera, as the original moves it (`rom.md`, The camera): pushed
 * sideways by a fighter near the screen's edge, never centred; lifted by an
 * eighth of the higher fighter's height. It also has the last word on where
 * the fighters stand, because which of them may move depends on whether
 * it does.
 *
 * Pure, and sized from outside: the screen's and the world's widths are the
 * caller's (`src/view.ts`, `src/stage.ts`), so widening either is not an edit
 * here. What stays here are the camera's own rules, in game px.
 */

/** How near the screen's edge — and the world's — a fighter may stand. */
const MARGIN = 16;
/** How far past that a fighter may drift before being put back on it ($0D:C7C4). */
const SNAP = 6;
/**
 * The camera rises a pixel for every 8 the higher fighter stands above the
 * floor — the height counted in steps of 8, at most 256 — and eases there a
 * pixel a frame ($0D:CA55).
 */
const LIFT_EVERY = 8;
const LIFT_STEP = 8;
const LIFT_REACH = 256;

export interface CameraSize {
  /** The screen's width, in game px. */
  screen: number;
  /** The world's width, in game px. */
  world: number;
  /** The floor's y, where a standing fighter's anchor is. */
  floor: number;
}

/** One fighter's x before and after this frame's movement. */
export interface Move {
  from: number;
  to: number;
}

export class Camera {
  /** The screen's left edge in the world. */
  x = 0;
  /** How far the camera has risen, in whole px ($0585); the screen's top is at −`rise`. */
  rise = 0;

  constructor(private readonly size: CameraSize) {}

  get y(): number {
    return -this.rise;
  }

  /** Where a fighter may stand at all: the world, short of its edges. */
  get world(): Bounds {
    return { min: MARGIN, max: this.size.world - MARGIN };
  }

  /** Where a fighter may stand now: the screen, short of its edges. */
  get screen(): Bounds {
    return { min: this.x + MARGIN, max: this.x + this.size.screen - MARGIN };
  }

  /** Over the middle of `a` and `b`, as far as the world reaches — not the original's, a debug start. */
  centreOn(a: number, b: number): void {
    this.x = this.clampX((a + b) / 2 - this.size.screen / 2);
  }

  /**
   * One frame sideways ($0D:C61B): scroll by what pushes, then hold each
   * fighter where the screen allows. Returns where the fighters end up.
   */
  follow(a: Move, b: Move | null): { a: number; b: number | null } {
    const da = a.to - a.from;
    const db = b ? b.to - b.from : 0;
    const wanted = pushOf(
      { x: a.from - this.x, d: da },
      b ? { x: b.from - this.x, d: db } : null,
      this.size.screen,
    );

    // The camera as it would stand, and the screen it would show.
    const next = this.clampX(this.x + wanted);
    let dx = next - this.x;
    const [left, right] = [next + MARGIN, next + this.size.screen - MARGIN];
    const [oldLeft, oldRight] = [this.x + MARGIN, this.x + this.size.screen - MARGIN];

    // A fighter leaving one side while the camera moves that way, or while
    // the other is pinned at the far side, stops the camera — and is stopped
    // at the old edge if walking out ($0D:C71E). Whole pixels, one short of
    // the fighter, as the original compares them.
    const stop = (m: Move, d: number, other: number | null): number => {
      const at = Math.floor(m.to) - 1;
      if (at < left) {
        if (dx > 0 || (other !== null && Math.floor(other) >= right)) {
          dx = 0;
          if (d < 0) return oldLeft - m.from;
        }
      } else if (at >= right) {
        if (dx < 0 || (other !== null && Math.floor(other) - 1 < left)) {
          dx = 0;
          if (d > 0) return oldRight - m.from;
        }
      }
      return d;
    };
    const ka = stop(a, da, b?.to ?? null);
    const kb = b ? stop(b, db, a.to) : 0;
    this.x += dx;

    // Put back on the screen's margin whoever drifted past it — measured, as
    // the original measures it, against the screen before any stop.
    const hold = (x: number): number => (x < left - SNAP ? left : x >= right + SNAP ? right : x);
    return { a: hold(a.from + ka), b: b ? hold(b.from + kb) : null };
  }

  /** One frame upward ($0D:CA55): toward an eighth of the higher fighter's height. */
  lift(ys: number[]): void {
    const top = Math.max(0, Math.floor(Math.min(...ys)));
    const height = this.size.floor - (top - (top % LIFT_STEP));
    const target = Math.floor(Math.max(0, Math.min(LIFT_REACH, height)) / LIFT_EVERY);
    this.rise += Math.sign(target - this.rise);
  }

  private clampX(x: number): number {
    return Math.max(0, Math.min(this.size.world - this.size.screen, x));
  }
}
