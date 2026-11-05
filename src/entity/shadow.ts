/** Which size of the floor's shadow a body casts by its height ($00:8212). Pure. */

/** Above this y there is no shadow, and at or below the other: y 0x79 and 0xCB. */
const HIGHEST = 0x79;
const BELOW = 0xcb;
/** The widest shows from here down to the floor: y 0xB8. */
const WIDEST = 0xb8;

/** The frame holding each size, in a fighter's sheet (`rom/shadow.ts`). */
export const shadowFrame = (size: number): string => `shadow${size}`;

/** The size at world y `y`, a step narrower every 16 px up, or null for none. */
export function shadowSize(y: number): number | null {
  if (y < HIGHEST || y >= BELOW) return null;
  return Math.floor(Math.max(0, WIDEST - y) / 16) & 3;
}
