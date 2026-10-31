/**
 * How big the game's screen is drawn, and whether the readouts fit beside it.
 * A whole number of window pixels per game pixel, never a fraction: a fraction
 * blurs pixel art. Pure, so the fitting is tested; `page.ts` measures the
 * window and applies the answer.
 */

/** A scale the owner picked, or `auto`: the largest that fits the window. */
export type ScaleChoice = "auto" | number;

/** What the page offers besides `auto`. Below 2 the page is not meant to work. */
export const SCALES = [2, 3, 4, 5, 6];

/** Under this key in localStorage, as the choice's text. */
export const REMEMBERED_SCALE = "db-hd-remake.scale";

/**
 * One readout column with its gap, in window px — wide enough for its longest
 * line (`ui/debug.ts`). Narrower than this, the readouts go under the game.
 */
export const READOUT_WIDTH = 360;

export interface Size {
  width: number;
  height: number;
}

export interface Layout {
  scale: number;
  /** The readouts stand left and right of the game rather than under it. */
  sideBySide: boolean;
}

/** What was kept, or `auto` when it does not read as a scale. */
export function readScale(text: string | null): ScaleChoice {
  const n = Number(text);
  return text !== null && Number.isInteger(n) && n >= 1 ? n : "auto";
}

/**
 * The scale to draw at in a window of `room`, with `chrome` px of it taken by
 * the bars above and below the game. `auto` keeps room for the readouts at
 * the sides: they are what is read during a combo, and under the game they
 * would push it up and down as they come and go.
 */
export function layout(choice: ScaleChoice, room: Size, chrome: number, screen: Size): Layout {
  const scale = choice === "auto" ? fit(room, chrome, screen) : choice;
  return { scale, sideBySide: room.width - screen.width * scale >= 2 * READOUT_WIDTH };
}

function fit(room: Size, chrome: number, screen: Size): number {
  const across = Math.floor((room.width - 2 * READOUT_WIDTH) / screen.width);
  const down = Math.floor((room.height - chrome) / screen.height);
  return Math.max(1, Math.min(across, down));
}
