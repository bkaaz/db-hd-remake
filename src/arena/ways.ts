/**
 * Where a blow that sends the opponent away takes the fight: the owner's graph
 * (2026-11-07, `combat.md`), built on the cartridge's (`rom.md`, Where a blow
 * sends him). Pure; `arena/travel.ts` carries it out.
 */

/** A sender's way: `9f` up, `a0` sideways, `a1` down. */
export type Way = "up" | "side" | "down";
export const WAYS: readonly Way[] = ["up", "side", "down"];

/** The floor's arenas, left to right, round again: going left from the first is the last. */
const RING = ["plains", "tournament", "ruins", "shore"];
/** Above them all, the one way up leads to; the original's sky and planet are not ours. */
const ABOVE = "palace";
/** Down from above, by the half of the world he was sent from, as from the original's sky ($0D:E1FB). */
const BELOW = { left: "plains", right: "tournament" };

export interface Sending {
  /** The attacker's facing: sideways, he sends him the way he faces. */
  facesLeft: boolean;
  /** Whether the defender stands in the world's right half. */
  rightHalf: boolean;
}

/** The arena a sender takes the fight to from `from`, or null where the way is closed and he only falls. */
export function wayFrom(from: string, way: Way, { facesLeft, rightHalf }: Sending): string | null {
  const at = RING.indexOf(from);
  if (from === ABOVE) return way === "down" ? (rightHalf ? BELOW.right : BELOW.left) : null;
  if (at < 0) return null;
  if (way === "up") return ABOVE;
  if (way === "down") return null;
  return RING[(at + (facesLeft ? -1 : 1) + RING.length) % RING.length];
}

/** Every arena some way leads to or from: what a scene loads ahead, to change without a wait. */
export const LINKED: readonly string[] = [...RING, ABOVE];

/**
 * Where the two stand once there, in world px: recorded after the tournament's
 * `a0` both ways (`tools/re/runs/sender-a0*.json`) — the attacker where his run in
 * ends, the defender where he falls in.
 */
export function arrival(facesLeft: boolean): { attacker: number; defender: number } {
  return facesLeft ? { attacker: 312, defender: 192 } : { attacker: 193, defender: 320 };
}
