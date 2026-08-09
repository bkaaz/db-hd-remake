/**
 * Deriving animation data from the sprites themselves.
 *
 * Frames are cut tight around the silhouette (the editor's auto-detection), so
 * the frame rectangle *is* the sprite's outline — enough to compute a hurt box
 * exactly, and to guess which frame is an attack's active one. This is the part
 * of authoring that must never be guessed by hand or by eye: it is arithmetic,
 * it is deterministic, and it runs in `scripts/anim.ts` rather than costing
 * anyone's attention.
 *
 * What it cannot know is judgement — how the move should feel, whether a pose
 * reads. Those stay with the owner, who adjusts in the editor.
 */

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pivot in px from the frame's top-left corner. */
  anchor: [number, number];
}

export interface DerivedBox {
  type: "hurt" | "hit";
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AnimKind = "loop" | "attack" | "hurt";

/**
 * A hurt box covering the sprite's silhouette, in anchor-relative px.
 * `inset` shrinks it on every side — useful because a tight rect also contains
 * hair spikes and aura, which usually should not be hittable.
 */
export function hurtBox(frame: FrameRect, inset = 0): DerivedBox | null {
  const w = frame.w - 2 * inset;
  const h = frame.h - 2 * inset;
  if (w <= 0 || h <= 0) return null;
  return { type: "hurt", x: -frame.anchor[0] + inset, y: -frame.anchor[1] + inset, w, h };
}

interface Band {
  top: number;
  bottom: number;
  min: number;
  max: number;
}

const bandArea = (b: Band): number => (b.bottom - b.top + 1) * (b.max - b.min + 1);

const merged = (a: Band, b: Band): Band => ({
  top: Math.min(a.top, b.top),
  bottom: Math.max(a.bottom, b.bottom),
  min: Math.min(a.min, b.min),
  max: Math.max(a.max, b.max),
});

/**
 * Hurt boxes that follow the body, from the sprite's opacity mask.
 *
 * One box per frame is too coarse: a frame's rectangle is the bounding box of
 * the whole silhouette, so an outstretched arm makes the legs as wide as the
 * punch. Instead, take each row's horizontal extent and merge neighbouring rows
 * greedily — always the pair that adds the least empty area — until `count`
 * bands remain. The result hugs the shape: a narrow head, a wide torso where
 * the arms are, narrow legs.
 *
 * `mask` is 1 per opaque pixel, `frame.w * frame.h`, row-major.
 */
export function hurtBoxesFromMask(
  mask: Uint8Array,
  frame: FrameRect,
  count = 3,
  inset = 0,
): DerivedBox[] {
  const bands: Band[] = [];
  for (let y = 0; y < frame.h; y++) {
    let min = -1;
    let max = -1;
    for (let x = 0; x < frame.w; x++) {
      if (mask[y * frame.w + x]) {
        if (min < 0) min = x;
        max = x;
      }
    }
    if (min >= 0) bands.push({ top: y, bottom: y, min, max });
  }
  if (bands.length === 0) return [];

  while (bands.length > Math.max(1, count)) {
    let at = 0;
    let cheapest = Infinity;
    for (let i = 0; i + 1 < bands.length; i++) {
      const cost = bandArea(merged(bands[i], bands[i + 1])) - bandArea(bands[i]) - bandArea(bands[i + 1]);
      if (cost < cheapest) {
        cheapest = cost;
        at = i;
      }
    }
    bands.splice(at, 2, merged(bands[at], bands[at + 1]));
  }

  const [ax, ay] = frame.anchor;
  return bands
    .map((b) => ({
      type: "hurt" as const,
      x: b.min - ax + inset,
      y: b.top - ay + inset,
      w: b.max - b.min + 1 - 2 * inset,
      h: b.bottom - b.top + 1 - 2 * inset,
    }))
    .filter((b) => b.w > 0 && b.h > 0);
}

/** How far a frame's silhouette reaches in front of its anchor. */
export function reach(frame: FrameRect): number {
  return frame.w - frame.anchor[0];
}

/**
 * Index of the frame that reaches furthest forward — for an attack that is the
 * extended limb, i.e. the active frame. Ties resolve to the earliest frame.
 */
export function activeIndex(frames: readonly FrameRect[]): number {
  let best = 0;
  for (let i = 1; i < frames.length; i++) {
    if (reach(frames[i]) > reach(frames[best])) best = i;
  }
  return best;
}

export interface HitGuess {
  box: DerivedBox;
  /**
   * `extension` — measured from how far this frame reaches beyond the others,
   * so the box covers the part that actually sticks out.
   * `fallback` — nothing measurably extends (e.g. a single-frame animation), so
   * the box is an arbitrary rectangle in front of the body. Always worth a look.
   */
  from: "extension" | "fallback";
}

/**
 * A **placeholder** hit box for the given frame. Horizontally it covers the
 * stretch between where the body normally ends and where this frame reaches;
 * vertically it sits at roughly chest height. Good enough to make the move
 * connect, and meant to be dragged into place by hand afterwards.
 */
export function hitBox(frames: readonly FrameRect[], index: number): HitGuess {
  const frame = frames[index];
  const band = { y: -Math.round(frame.h * 0.72), h: Math.max(4, Math.round(frame.h * 0.22)) };
  const restReach = Math.min(...frames.map(reach));
  const extension = Math.round(reach(frame) - restReach);

  if (extension >= 2) {
    return {
      box: { type: "hit", x: Math.round(restReach), w: extension, ...band },
      from: "extension",
    };
  }
  // Nothing sticks out to measure — put a box in the outer half of the reach.
  const r = reach(frame);
  return {
    box: { type: "hit", x: Math.round(r * 0.4), w: Math.max(4, Math.round(r * 0.6)), ...band },
    from: "fallback",
  };
}

/**
 * Default step durations in game frames (60 FPS). An attack is not uniform:
 * it winds up, is briefly active, then recovers — the active frames are the
 * shortest, which is what makes a move feel sharp.
 *
 * These are sensible fighting-game numbers, **not** measured Hyper Dimension
 * frame data (the original's is not documented — see docs/game-overview.md).
 * They are a starting point to be tuned by feel.
 */
export function durations(
  kind: AnimKind,
  count: number,
  active: number,
  override?: number,
): number[] {
  if (override !== undefined) return Array<number>(count).fill(Math.max(1, override));
  if (count === 0) return [];
  switch (kind) {
    case "loop":
      return Array<number>(count).fill(6);
    case "hurt":
      // ~12 frames of reaction, however many steps it is drawn in.
      return Array<number>(count).fill(Math.max(2, Math.round(12 / count)));
    case "attack":
      return Array.from({ length: count }, (_, i) => (i < active ? 4 : i === active ? 2 : 5));
  }
}
