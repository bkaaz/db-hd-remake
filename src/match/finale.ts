import type { ShakeDef } from "../camera/shake";

/**
 * How a scene ends — Saiyan Meteor's ball ($20:8D93, by field `f1`): thrown
 * from the mover's hands at where the opponent lies, flying at `speed` px a
 * frame until it reaches the floor, swelling there into an explosion, then
 * the arena held white with bursts all over the screen before the blow
 * lands. Pure, so the timeline is tested; `seize.ts` plays it on the pair.
 */
export interface FinaleDef {
  /** The mover's frame the ball leaves on (394). */
  frame: number;
  /** Where the ball sits, from the mover, x toward its facing — its last `ball`'s `at`. */
  from: [number, number];
  /** Px a frame along the line to him: 2.0 ×4 ($0D:DB49, $20:8DB7). */
  speed: number;
  /**
   * Its radius in flight: `$20:8E63`'s by the move's frame & 3, and that
   * frame is held while it flies — 394 & 3 is 2, so 0x49.
   */
  radius: number;
  /** The mover's frame once it lands ($20:8E4B: 454). */
  resume: number;
  /** The explosion's growth a frame and its full radius ($20:8E6C: 2, 0x70). */
  grow: number;
  max: number;
  /**
   * Frames between the explosion and the white: the band along the floor
   * opening to the screen's edges ($0F:F1BC, then $0F:F1F3 until it answers
   * — 2). Not drawn yet.
   */
  band: number;
  /** Frames the arena is held white before the blow ($20:8EB5: 60). */
  white: number;
  /** A burst somewhere on the screen every `every` frames of the white ($0F:F241). */
  every: number;
  fx: string;
  /**
   * Played as the ball is thrown and as it hits the floor (owner, by ear:
   * the ki shot's, then clip 023). The original asks for 2c every 64th frame
   * while white ($0F:F2A0); what it plays as the ball leaves, is not read.
   */
  sounds?: { thrown?: string; landed?: string };
  /** The stage's shakes: as it lands, as the explosion is done, as the white begins. */
  shakes: [ShakeDef, ShakeDef, ShakeDef];
}

export type FinalePhase = "flying" | "exploding" | "band" | "white" | "done";

export interface Finale {
  phase: FinalePhase;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Frames left of the band, then of the white. */
  left: number;
}

/** The ball leaving the hands at (`x`, `y`) for (`tx`, `ty`), `scale` screen px a sprite px. */
export function throwBall(def: FinaleDef, x: number, y: number, tx: number, ty: number, scale = 1): Finale {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = def.speed * scale;
  return { phase: "flying", x, y, vx: (dx / d) * speed, vy: (dy / d) * speed, radius: def.radius * scale, left: def.band };
}

/** What a frame of the finale did, beside where it now is. */
export interface FinaleEvents {
  landed?: boolean;
  exploded?: boolean;
  /** The white begins. */
  white?: boolean;
  burst?: boolean;
  done?: boolean;
}

/** One frame over a floor at `floor`. */
export function finaleStep(f: Finale, def: FinaleDef, floor: number): [Finale, FinaleEvents] {
  if (f.phase === "flying") {
    const y = f.y + f.vy;
    if (y < floor) return [{ ...f, x: f.x + f.vx, y }, {}];
    return [{ ...f, x: f.x + f.vx, y: floor, phase: "exploding" }, { landed: true }];
  }
  if (f.phase === "exploding") {
    const radius = Math.min(f.radius + def.grow, def.max);
    if (radius < def.max) return [{ ...f, radius }, {}];
    return [{ ...f, radius: 0, phase: "band" }, { exploded: true }];
  }
  if (f.phase === "band") {
    if (f.left > 1) return [{ ...f, left: f.left - 1 }, {}];
    return [{ ...f, phase: "white", left: def.white }, { white: true }];
  }
  if (f.phase === "white") {
    const left = f.left - 1;
    if (left > 0) return [{ ...f, left }, { burst: (def.white - left) % def.every === 0 }];
    return [{ ...f, left: 0, phase: "done" }, { done: true }];
  }
  return [f, {}];
}
