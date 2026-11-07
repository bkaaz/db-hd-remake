/**
 * The screen of blue curved bands a sideways journey crosses (`rom.md`, The
 * journey's screens): colour windows the cartridge moves through four tables a
 * way, every frame, turning them inside out every fourth. Drawn once from the
 * ROM as a picture of every screen there is (`rom/bands.ts`); this says which
 * one shows when. Pure.
 */

export const BAND_SCREEN = { width: 256, height: 224 };

/** Tables a way, each drawn plain and inside out. */
export const BAND_TABLES = 4;

/** Which screen of the picture, top to bottom: leftward first, by table, plain then inside out. */
export function bandScreen(towardLeft: boolean, table: number, insideOut: boolean): number {
  return (towardLeft ? 0 : BAND_TABLES * 2) + table * 2 + (insideOut ? 1 : 0);
}

/**
 * Which screen shows on each frame of it: the table after `$1600` & 3 — 3 picks
 * the first — and the windows turned inside out each time the first comes
 * round ($01:8962).
 */
export class BandClock {
  private count = 0;
  private insideOut = false;

  constructor(private readonly towardLeft: boolean) {}

  next(): number {
    const table = (this.count++ + 1) % BAND_TABLES;
    if (table === 0) this.insideOut = !this.insideOut;
    return bandScreen(this.towardLeft, table, this.insideOut);
  }
}
