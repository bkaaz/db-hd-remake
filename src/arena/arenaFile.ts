/**
 * The shape of an arena on disk, and the only declaration of it: written by
 * `npm run rom -- export`, read by the game. `data/arenas/<name>/arena.json`
 * says how its layers move; each layer's picture, one per lighting, is
 * `assets/arenas/<name>/<layer>@<time>.png`, as large as the world. A layer
 * with `numbered` also has `<layer>-numbers@<time>.png`, each pixel's colour
 * number in red; each of `cycles` has `cycle<i>@<time>.png`, a row per step.
 *
 * Pure, so the export and the game import the same thing.
 */

/** The lighting a fighter's own sheet is drawn in: any other asks for a sheet of its own. */
export const OWN_COLOURS = "day";

export interface ArenaFile {
  /** The lightings it comes in, the first being the default — `day`, `evening`, `night`. */
  times: string[];
  /** Back to front; the fighters are drawn in front of them all. */
  layers: ArenaLayer[];
  /** The palettes that step by themselves, none if it has none. */
  cycles?: PaletteCycle[];
}

/** One BG palette the arena repaints as it goes, ignoring the fight: ADR 0081, `arena/cycles.ts`. */
export interface PaletteCycle {
  /** Which of the 8: its colours are numbers 16 × this on. */
  palette: number;
  steps: number;
  /** The step it stands on as the arena opens. */
  start: number;
  /** Frames on each step, or on all of them. */
  hold: number | number[];
}

export interface ArenaLayer {
  name: string;
  /**
   * How it scrolls sideways with the camera: its own scroll is
   * `camera x × speed + offset`. The world itself is `[1, 0]`; a sky farther
   * away moves slower, and the offset lines it up where the screen starts.
   */
  scroll: [speed: number, offset: number];
  /** It holds colours of a palette in `cycles`. */
  numbered?: boolean;
}
