/**
 * How much a combo's Nth blow is worth — the soft half of the limits.
 *
 * The hard rules refuse things: rank refuses a reaction, the relaunch limit refuses
 * a lift. Scaling refuses nothing. It makes a long combo *worth* less than a
 * short one, so a fifteen-hit sequence is a display of skill rather than a round
 * won by touching somebody once.
 *
 * A curve rather than a budget on each move, deliberately (`docs/combat.md` §3):
 * there will be hundreds of moves and three curves, and a system that asks every
 * future move for a juggle cost is a system nobody finishes.
 *
 * Pure: a function of how many blows have already landed on the victim, and
 * nothing else. The count lives on the defender's `Combo`, which is the one
 * piece of state all of this hangs off.
 */

/** The first blow of a combo is always worth all of itself. */
const FULL = 1;

/** What each blow after the first takes off the next one's worth. */
const STEP = 0.1;

/**
 * The damage floor, so a long combo still costs the victim something.
 *
 * A blow worth nothing is worse than it sounds: it still stops them, still holds
 * them, and would let a combo be extended indefinitely at no cost to the
 * attacker's patience. Twenty per cent keeps the incentive to end a combo and
 * start a new one, which is where the reset — and the risk — lives.
 */
const DAMAGE_FLOOR = 0.2;

/**
 * The hitstun floor, and it sits much higher than the damage one because it is
 * measured in something a person has to *see*.
 *
 * Twenty per cent of a reaction is three or four frames: the victim would snap
 * back to standing before the hurt pose had been on screen long enough to read,
 * and a combo would end in a flicker rather than in a recovery. Half is still
 * short enough that the defender wins the race — which is the whole job of this
 * curve — while leaving a reaction that looks like one.
 */
const HITSTUN_FLOOR = 0.5;

/** The one curve both scalings ride, differing only in how far they may fall. */
function curve(hits: number, floor: number): number {
  return Math.max(floor, FULL - STEP * Math.max(0, hits));
}

/**
 * What a blow is worth when `hits` have already landed since the victim last had
 * control. `hits` of 0 is the opener, and is worth all of itself.
 */
export function damageScale(hits: number): number {
  return curve(hits, DAMAGE_FLOOR);
}

/** How long a blow holds, as a fraction, after `hits` have already landed. */
export function hitstunScale(hits: number): number {
  return curve(hits, HITSTUN_FLOOR);
}

/**
 * A blow's damage after scaling, in whole health points.
 *
 * Rounded, and never below one: an attack that connects has to cost something,
 * or the last blows of a long combo become free and the counter becomes a lie.
 * A blow that was authored to cost nothing still costs nothing.
 */
export function scaledDamage(damage: number, hits: number): number {
  if (damage <= 0) return 0;
  return Math.max(1, Math.round(damage * damageScale(hits)));
}

/**
 * How many frames a blow holds its victim, after the combo it lands in has
 * shortened it — the half of scaling that changes a combo's *shape*.
 *
 * This is what ends a corner loop: every blow leaves the defender a frame or two
 * freer than the last, until the link the attacker relies on is simply not there
 * any more. The combo stops because it stopped working, which reads as a fighter
 * recovering rather than as a blow being refused.
 *
 * It shortens the knockback with it, deliberately: a ground reaction moves for
 * exactly as long as it holds, so the tenth blow of a combo shoves less than the
 * first. One number, one consequence — separating the two would mean a second
 * clock on the defender to say the same thing twice.
 */
export function scaledHitstun(frames: number, hits: number): number {
  if (frames <= 0) return 0;
  return Math.max(1, Math.round(frames * hitstunScale(hits)));
}
