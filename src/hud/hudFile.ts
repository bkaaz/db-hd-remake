/**
 * The shape of the original's HUD on disk, and the only declaration of it:
 * written by `npm run rom -- export` (`src/rom/hud.ts`), read by the game.
 * `data/hud/hud.json` says where each part goes and which tiles draw it;
 * `assets/hud/hud.png` holds the pictures — the band on top, then a row of
 * tiles for each part, tile n at x = 8n, in that part's colours.
 *
 * Cells are counted in tiles from the screen's top left; a part's cells run
 * rightward from `at`, one per player.
 */

export interface HudFile {
  /** The band's height in the picture, in px; above `black` it hides the arena. */
  band: number;
  black: number;
  /**
   * Which picture row (y, in px) draws each part's tiles; the bars have a
   * row per colour, player one's and player two's, in `bar.flash`'s order.
   */
  rows: { number: number; name: number; bar: [number, number][] };
  /** Three digits two tiles tall: digit d is tile `tile` + 2d over the one after it ($00:C5FC). */
  number: { tile: number; at: [Cell, Cell] };
  /**
   * Ten tiles: a cap filled 0–5 px, eight tiles 0–8 px, a cap 0–5 px — each
   * list the tile for that many px ($00:C62D). Player two's are laid right
   * to left ($00:C6A2).
   */
  bar: { first: number[]; middle: number[]; last: number[]; at: [Cell, Cell]; flash: BarFlash };
  /** Nine tiles of a fighter's name ($00:C511), 0 for none. */
  name: { at: [Cell, Cell] };
  names: Record<string, number[]>;
}

/**
 * The bar's colour ($00:C6DE): its first from `below` up; under it, the
 * game's frame count picks `cycle[(frame / hold) % cycle.length]`.
 */
export interface BarFlash {
  below: number;
  hold: number;
  cycle: number[];
}

/** [column, row]. */
export type Cell = [number, number];
