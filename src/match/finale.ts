import type { ShakeDef } from "../camera/shake";

/**
 * How a scene ends — Saiyan Meteor's ball ($20:8D93, by field `f1`): thrown
 * from the mover's hands at where the opponent lies, flying at `speed` px a
 * frame until it reaches the floor, swelling there into an explosion, then
 * the arena held white with bursts all over the screen before the blow
 * lands. Galactic Gunfire's drops straight down ($20:9E57). Pure, so the
 * timeline is tested; `seize.ts` plays it on a seized opponent,
 * `finales.ts` on its own (ADR 0058).
 */
export interface FinaleDef {
  /** The mover's frame the ball leaves on (394). */
  frame: number;
  /** Where the ball sits, from the mover, x toward its facing — its last `ball`'s `at`. */
  from: [number, number];
  /** Px a frame along the line to him: 2.0 ×4 ($0D:DB49, $20:8DB7). */
  speed: number;
  /** Straight down to the floor rather than at him — Galactic Gunfire's 4 px a frame. */
  aim?: "down";
  /**
   * Its radius in flight: `$20:8E63`'s by the move's frame & 3, and that
   * frame is held while it flies — 394 & 3 is 2, so 0x49.
   */
  radius: number;
  /** The mover's frame once it lands ($20:8E4B: 454), in a seize. */
  resume?: number;
  /** The explosion's growth a frame and its full radius ($20:8E6C: 2, 0x70). */
  grow: number;
  max: number;

  /**
   * No ball: a wedge of light from `from` down to the floor, swept across the
   * screen at `each` px a frame, `half` px either side at the floor (kind 6,
   * Buu Breath's, $0F:F0DF), and then the band.
   */
  sweep?: { each: number; half: number };

  /** Frames the arena is held white before the blow ($20:8EB5: 60). */
  white: number;
  /** A burst somewhere on the screen every `every` frames of the white ($0F:F241). */
  every: number;
  fx: string;
  /**
   * Played as the ball is thrown and as it hits the floor (owner, by ear:
   * the ki shot's, then clip 023), and every 64th frame of the white — the
   * original's `2c` on its frame counter's ($0F:F2A0), ours on the white's.
   * What it plays as the ball leaves is not read.
   */
  sounds?: { thrown?: string; landed?: string; white?: string };
  /** The stage's shakes: as it lands (Galactic Gunfire's none), as the explosion is done, as the white begins. */
  shakes: [ShakeDef | null, ShakeDef, ShakeDef];
}

export type FinalePhase = "sweep" | "flying" | "exploding" | "band" | "white" | "done";

export interface Finale {
  phase: FinalePhase;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Frames left: the band's one of opening to the screen's sides, then the white's. */
  left: number;
  /** The band's `b1` size, kind 4 — 2 × size tall along the floor; 0 when none. */
  band: number;
}

/**
 * The band along the floor ($0F:F1BC, $0F:F1F3): kind 4 at size 2 across the
 * screen, opened 4 px each side for a frame, then 16 thicker a frame until
 * its size is 0xC0 — the screen filled with light, and the white.
 */
const BAND = { from: 2, grow: 16, full: 0xc0 };
const SCREEN = 256;
/** The original's frame counter wraps its `2c` every 64 frames ($0F:F2A0). */
const TOLL = 64;

/** The ball leaving the hands at (`x`, `y`) for (`tx`, `ty`), `scale` screen px a sprite px. */
export function throwBall(def: FinaleDef, x: number, y: number, tx: number, ty: number, scale = 1): Finale {
  // a sweep starts from the screen's left, which the caller gives as `tx`
  if (def.sweep) return { phase: "sweep", x: tx, y, vx: def.sweep.each * scale, vy: x, radius: 0, left: Math.ceil(SCREEN / def.sweep.each), band: 0 };
  const dx = def.aim === "down" ? 0 : tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = def.speed * scale;
  return { phase: "flying", x, y, vx: (dx / d) * speed, vy: (dy / d) * speed, radius: def.radius * scale, left: 0, band: 0 };
}

/** What a frame of the finale did, beside where it now is. */
export interface FinaleEvents {
  landed?: boolean;
  exploded?: boolean;
  /** The white begins. */
  white?: boolean;
  burst?: boolean;
  /** Its white's sound, every 64th frame. */
  toll?: boolean;
  done?: boolean;
}

/** One frame over a floor at `floor`. */
export function finaleStep(f: Finale, def: FinaleDef, floor: number): [Finale, FinaleEvents] {
  if (f.phase === "sweep") {
    if (f.left > 1) return [{ ...f, x: f.x + f.vx, left: f.left - 1 }, {}];
    return [{ ...f, phase: "band", band: BAND.from, left: 1 }, {}];
  }
  if (f.phase === "flying") {
    const y = f.y + f.vy;
    if (y < floor) return [{ ...f, x: f.x + f.vx, y }, {}];
    return [{ ...f, x: f.x + f.vx, y: floor, phase: "exploding" }, { landed: true }];
  }
  if (f.phase === "exploding") {
    const radius = Math.min(f.radius + def.grow, def.max);
    if (radius < def.max) return [{ ...f, radius }, {}];
    return [{ ...f, radius: 0, phase: "band", band: BAND.from, left: 1 }, { exploded: true }];
  }
  if (f.phase === "band") {
    if (f.left > 0) return [{ ...f, left: f.left - 1 }, {}];
    if (f.band < BAND.full) return [{ ...f, band: f.band + BAND.grow }, {}];
    return [{ ...f, phase: "white", band: 0, left: def.white }, { white: true, toll: true }];
  }
  if (f.phase === "white") {
    const left = f.left - 1;
    const elapsed = def.white - left;
    if (left > 0) return [{ ...f, left }, { burst: elapsed % def.every === 0, toll: elapsed % TOLL === 0 }];
    return [{ ...f, left: 0, phase: "done" }, { done: true }];
  }
  return [f, {}];
}
