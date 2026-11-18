import type { Anim } from "../entity/entityFile";

/**
 * How far an animation's drawings reach from the anchor, in game px: what a
 * box must hold for the fighter to stand in it whichever way he faces. Pure,
 * so the select screen sizes its cells from the fighters instead of a guess.
 */
export interface Reach {
  /** Either side of the anchor, the wider of the two: facing flips them. */
  half: number;
  /** Above the anchor. */
  up: number;
  /** Below it: a drawing's shadow and feet hang past the floor. */
  down: number;
}

export function reachOf(anim: Anim, frames: ReadonlyMap<string, { anchor: [number, number]; w: number; h: number }>): Reach {
  const reach: Reach = { half: 0, up: 0, down: 0 };
  for (const step of anim.steps) {
    const f = frames.get(step.frame);
    if (!f) continue;
    const [ax, ay] = f.anchor;
    reach.half = Math.max(reach.half, ax, f.w - ax);
    reach.up = Math.max(reach.up, ay);
    reach.down = Math.max(reach.down, f.h - ay);
  }
  return reach;
}

/** The reach that holds all of them. */
export function widest(reaches: readonly Reach[]): Reach {
  return reaches.reduce((a, b) => ({ half: Math.max(a.half, b.half), up: Math.max(a.up, b.up), down: Math.max(a.down, b.down) }), { half: 0, up: 0, down: 0 });
}
