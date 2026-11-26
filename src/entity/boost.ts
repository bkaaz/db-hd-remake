/**
 * The boost (RB): a move's own charge played fast, to its top, while the
 * opponent and every bolt stand still — its states, drawings, ball and sounds
 * as by hand, nothing of the boost's own (owner, 2026-11-26). One rule for
 * every move that charges, so none needs a boost of its own written out.
 * Pure: the tempo; the entity runs the steps.
 */

/** On the state a charge begins in: what boosting it asks. */
export interface BoostDef {
  /** The button the charge is held on, held for him while it plays. */
  hold: "smash" | "blast";
  /** Frames the charge takes by hand, to its top. */
  frames: number;
  /** Ki the boost costs over the charge's own, paid as it ends: a bar. */
  bar: number;
  /** Ki he must have to boost: the bar and what the charge's levels will cost. */
  needs: number;
}

/** Frames of the fight every boost takes, however long its charge by hand (owner, 2026-11-26). */
export const BOOST_FRAMES = 18;

/** A charge being boosted: how many of its frames each frame of the fight plays. */
export class Boost {
  private owed = 0;

  constructor(readonly def: BoostDef) {}

  /** The charge's frames to play this frame of the fight, so the whole fits in `BOOST_FRAMES`. */
  take(): number {
    this.owed += this.def.frames / BOOST_FRAMES;
    const steps = Math.floor(this.owed + 1e-9);
    this.owed -= steps;
    return steps;
  }
}
