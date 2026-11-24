/**
 * What the HUD shows of a fighter's health, as numbers: the health it shows,
 * which trails the real one as the original's does ($00:C57D), the layers
 * that health is drawn in, and how the last one flashes ($00:C6DE).
 */

/** One frame: the shown health steps 1 toward the real one, so a blow drains rather than cuts. */
export function stepShown(shown: number, health: number): number {
  return shown + Math.sign(Math.round(health) - shown);
}

/** A layer's worth of health: the top layer drains over the next, full and a shade darker (owner, 2026-11-24). */
export const LAYER = 100;

/** How many layers have health left, and how much the top one has (1 to `LAYER`; 0 when none). */
export function layersOf(shown: number): { count: number; left: number } {
  const count = Math.max(0, Math.ceil(shown / LAYER));
  return { count, left: count === 0 ? 0 : shown - (count - 1) * LAYER };
}

/** Below this the last layer flashes. */
export const FLASH_BELOW = 81;
/** Frames each colour of the flash holds, of the game's frame count. */
const FLASH_HOLD = 3;

/**
 * Which colour of the flash the bar is in this frame — 0 dark red, 1 yellow,
 * 2 orange, 3 red, both bars in step — or null while it is steady.
 */
export function flashStep(shown: number, frame: number): number | null {
  return shown >= FLASH_BELOW ? null : Math.floor(frame / FLASH_HOLD) % 4;
}
