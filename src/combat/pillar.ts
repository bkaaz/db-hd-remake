/**
 * The light a move stands on the floor ahead of him, `b1` kind 4 at $30BA: pure,
 * so its timing is tested. Apart from `sceneLight.ts`, whose bars belong to a
 * scene with a held body: this one is a plain state's, and outlives its state.
 */

export interface PillarDef {
  /** The state's frame it starts on, 0 if absent. */
  from?: number;
  /** Sprite px toward his facing, kept on him every frame ($10:CD44). */
  ahead: number;
  /** How it goes once risen: narrower ($10:CDB5, Bakuretsu Rush) or lower ($10:CD9E, Tri Eruption). */
  ends: "narrowing" | "sinking";
  /** Shown every other frame while it moves ($10:CA94). */
  flickers?: boolean;
}

/** One side's width: a pixel more a frame, to this ($10:CD7C). */
const WIDEST = 16;
/** Height: its half 8 px more a frame, stopping short of 0x80 ($10:CD8D), and it stands on the floor with its middle one half up ($2A:A7D0). */
const RISE = 16;
const TALLEST = 0xf0;
/** Frames from the first until it has risen: the call that finds no more room is one. */
const RISEN = TALLEST / RISE + 1;

export interface PillarShape {
  half: number;
  height: number;
}

/** Its shape `t` frames in, 0 on the frame it starts, null once gone; a half of 0 draws nothing. */
export function pillarAt(def: PillarDef, t: number): PillarShape | null {
  const half = Math.min(t, WIDEST);
  const height = Math.min(t * RISE, TALLEST);
  if (t <= RISEN) return visible(def, t, { half, height });
  const past = t - RISEN;
  const shape = def.ends === "narrowing" ? { half: WIDEST - past, height } : { half, height: TALLEST - past * RISE };
  return shape.half <= 0 || shape.height <= 0 ? null : visible(def, t, shape);
}

/** Lit on the frame it starts and on odd frames; on the risen frame it keeps the last one's. */
function visible(def: PillarDef, t: number, shape: PillarShape): PillarShape {
  if (!def.flickers) return shape;
  const count = t <= RISEN ? Math.min(t, RISEN - 1) : t - 1;
  return t === 0 || count % 2 === 1 ? shape : { ...shape, half: 0 };
}
