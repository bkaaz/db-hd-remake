/**
 * The shape of an arena on disk, and the only declaration of it: written by
 * `npm run rom -- export`, read by the game. `data/arenas/<name>/arena.json`
 * says how its layers move; each layer's picture, one per lighting, is
 * `assets/arenas/<name>/<layer>@<time>.png`, as large as the world.
 *
 * Pure, so the export and the game import the same thing.
 */

export interface ArenaFile {
  /** The lightings it comes in, the first being the default — `day`, `evening`, `night`. */
  times: string[];
  /** Back to front; the fighters are drawn in front of them all. */
  layers: ArenaLayer[];
}

export interface ArenaLayer {
  name: string;
  /**
   * How it scrolls sideways with the camera: its own scroll is
   * `camera x × speed + offset`. The world itself is `[1, 0]`; a sky farther
   * away moves slower, and the offset lines it up where the screen starts.
   */
  scroll: [speed: number, offset: number];
}
