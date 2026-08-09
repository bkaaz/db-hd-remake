/**
 * Collision between entities: does an attacker's active hit box reach a
 * defender's hurt box?
 *
 * Authored boxes are in sprite pixels, relative to the frame's anchor, Y-down
 * (docs/data-format.md). This module converts them to world pixels — including
 * the mirror when facing left — and tests overlap. Pure: no PixiJS, no DOM.
 *
 * The renderer draws its overlay through `boxToWorld` too, so what you see is
 * exactly what collides.
 */

/** An authored box; only the rectangle matters here. */
export interface BoxLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where an entity stands, and at what render scale. */
export interface Placement {
  /** World x of the anchor. */
  x: number;
  /** World y of the anchor (the ground line). */
  y: number;
  facing: 1 | -1;
  scale: number;
}

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Place an authored box in the world, mirroring X when facing left. */
export function boxToWorld(box: BoxLike, at: Placement): WorldRect {
  return {
    x: at.facing < 0 ? at.x - (box.x + box.w) * at.scale : at.x + box.x * at.scale,
    y: at.y + box.y * at.scale,
    w: box.w * at.scale,
    h: box.h * at.scale,
  };
}

/** Rectangle overlap. Touching edges do not count as a hit. */
export function overlaps(a: WorldRect, b: WorldRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The rectangle two boxes share. Only meaningful when they overlap. */
export function intersection(a: WorldRect, b: WorldRect): WorldRect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    w: Math.min(a.x + a.w, b.x + b.w) - x,
    h: Math.min(a.y + a.h, b.y + b.h) - y,
  };
}

/**
 * Where an attacker's hit box first meets a defender's hurt box, or null if it
 * does not. The overlap rectangle rather than a plain yes/no, because a hit
 * spark belongs at the point of contact — and the first overlapping pair is the
 * right one: boxes are authored in the order they matter.
 */
export function contact(
  attacker: { boxes: readonly BoxLike[]; at: Placement },
  defender: { boxes: readonly BoxLike[]; at: Placement },
): WorldRect | null {
  for (const hit of attacker.boxes) {
    const h = boxToWorld(hit, attacker.at);
    for (const hurt of defender.boxes) {
      const d = boxToWorld(hurt, defender.at);
      if (overlaps(h, d)) return intersection(h, d);
    }
  }
  return null;
}

/**
 * Where the impact should be drawn, given the overlap and which way the blow
 * travels: the **leading edge** of the overlap, at its mid height.
 *
 * Not the middle of the overlap. A fist box is narrow and sits entirely inside
 * the body it strikes, so the overlap *is* the fist — and its centre lands on
 * the attacker's forearm, which reads as a spark stuck to the puncher rather
 * than something happening to the fighter being hit. The far edge is the
 * deepest point the blow reaches, which is where a fist meets a body.
 */
export function impactPoint(overlap: WorldRect, facing: 1 | -1): { x: number; y: number } {
  return {
    x: facing > 0 ? overlap.x + overlap.w : overlap.x,
    y: overlap.y + overlap.h / 2,
  };
}

