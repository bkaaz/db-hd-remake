import { smallDots, smallWidth } from "./font";
import type { Shown } from "./hits";

/**
 * The hit counter, drawn under the panel of whoever lands the combo, after
 * Burst Limit's: "N HITS" over "N DAMAGE" in the small font, the numbers
 * ending where the words begin, so the words stand in a column.
 */

const TOP = 52;
/** From his own edge, as his panel is. */
const EDGE = 8;
/** A line's height and the gap under it. */
const LINE = 10;
const GAP = 4;
/** Its lowest pixel, outline included: the HUD's canvas reaches this far. */
export const COUNTER_BOTTOM = TOP + 2 * LINE;

export function drawCounter(g: CanvasRenderingContext2D, side: 0 | 1, s: Shown): void {
  const rows = [[String(s.hits), "HITS"], [String(s.damage), "DAMAGE"]];
  const numbers = Math.max(...rows.map(([n]) => smallWidth(n)));
  const wide = numbers + GAP + Math.max(...rows.map(([, w]) => smallWidth(w)));
  const left = side ? g.canvas.width - EDGE - wide : EDGE;
  rows.forEach(([n, w], i) => {
    const y = TOP + i * LINE;
    write(g, n, left + numbers - smallWidth(n), y);
    write(g, w, left + numbers + GAP, y);
  });
}

/** White, outlined in black, as the names are. */
function write(g: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  const dots = smallDots(text);
  g.fillStyle = "#000000";
  for (const [a, b] of dots) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) g.fillRect(x + a + dx, y + b + dy, 1, 1);
  g.fillStyle = "#ffffff";
  for (const [a, b] of dots) g.fillRect(x + a, y + b, 1, 1);
}
