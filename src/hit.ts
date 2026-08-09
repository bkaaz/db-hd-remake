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

/**
 * True if any of the attacker's hit boxes reaches any of the defender's hurt
 * boxes. Both sides pass the boxes active on their current animation step.
 */
export function connects(
  attacker: { boxes: readonly BoxLike[]; at: Placement },
  defender: { boxes: readonly BoxLike[]; at: Placement },
): boolean {
  for (const hit of attacker.boxes) {
    const h = boxToWorld(hit, attacker.at);
    for (const hurt of defender.boxes) {
      if (overlaps(h, boxToWorld(hurt, defender.at))) return true;
    }
  }
  return false;
}
