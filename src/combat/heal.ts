/**
 * Charging as the original does it ($0F:A020): a dial steps every few
 * frames, and each full turn gives back some health, never past what the
 * fighter started with. The HUD draws the dial (`hud/`).
 *
 * The original has one pool — the number on the HUD is health and energy
 * both — so its charging refills health. Ours keeps a ki meter beside it,
 * which this does not touch: everything goes to health for now, to stay
 * near the original while it is ported, and will change (owner, 2026-10-30).
 *
 * Pure: numbers in, numbers out.
 */

/** On a state: the dial steps every `every` frames, and a turn of `turn` steps gains `gain`. */
export interface HealDef {
  every: number;
  turn: number;
  gain: number;
}

/**
 * One frame of charging, `clock` frames into it: the dial's new position and
 * the health it gave — on the step that would complete the turn, the dial
 * goes back to 0 and the health comes.
 */
export function healFrame(dial: number, clock: number, def: HealDef): { dial: number; gain: number } {
  if (clock % def.every !== 0) return { dial, gain: 0 };
  return dial >= def.turn - 1 ? { dial: 0, gain: def.gain } : { dial: dial + 1, gain: 0 };
}
