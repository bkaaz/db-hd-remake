import type { BarFlash, HudFile } from "./hudFile";

/**
 * What the original's HUD shows of a fighter's health ($00:C57D), as pure
 * numbers: the health it shows, which trails the real one, its three digits
 * and its bar's ten tiles.
 */

/** One frame: the shown health steps 1 toward the real one, so a blow drains rather than cuts. */
export function stepShown(shown: number, health: number): number {
  return shown + Math.sign(Math.round(health) - shown);
}

/** Hundreds, tens, ones — always three, leading zeros and all ($00:9A4F). */
export function digits(n: number): [number, number, number] {
  const v = Math.max(0, Math.min(999, Math.round(n)));
  return [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10];
}

/** Which of the bar's colours to show — its own, or below `flash.below` one of a cycle the frame count steps through. */
export function barColour(shown: number, frame: number, flash: BarFlash): number {
  return shown >= flash.below ? 0 : flash.cycle[Math.floor(frame / flash.hold) % flash.cycle.length];
}

/**
 * The bar's ten tiles, left to right, for a shown health ($00:C62D): half of
 * it, at least 1 while any is left and 1 less from 2 up, fills a cap of 5
 * px, eight tiles of 8 and a cap of 5 — so it is full from 150 up.
 */
export function barTiles(shown: number, bar: HudFile["bar"]): number[] {
  let v = shown <= 0 ? 0 : Math.max(1, shown >> 1);
  if (v >= 2) v--;
  v = Math.min(v, 255);
  const take = (most: number): number => {
    const n = Math.min(v, most);
    v -= n;
    return n;
  };
  const first = bar.first[take(bar.first.length - 1)];
  const middle = Array.from({ length: 8 }, () => bar.middle[take(bar.middle.length - 1)]);
  return [first, ...middle, bar.last[take(bar.last.length - 1)]];
}
