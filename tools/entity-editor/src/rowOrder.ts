/**
 * Reading order for detected sprites.
 *
 * Sprite sheets are laid out in rows, and neighbouring sprites in a row belong
 * together — so frame numbers must run left to right along a row, then down to
 * the next one. Sorting by top edge alone does not do that: sprites in one row
 * are cut tight, so a taller pose starts a few pixels higher and would steal a
 * lower number from a sprite to its left.
 *
 * So: group into rows by vertical overlap first, then sort each row by x.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Row<T> {
  top: number;
  bottom: number;
  items: T[];
}

/**
 * A rect joins the current row when it shares at least half its height with
 * that row's vertical band. Half, rather than any overlap at all, stops one
 * tall sprite from swallowing the row beneath it.
 */
export function rowMajor<T extends Rect>(rects: readonly T[]): T[] {
  const byTop = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Row<T>[] = [];

  for (const rect of byTop) {
    const row = rows[rows.length - 1];
    if (row) {
      const overlap = Math.min(row.bottom, rect.y + rect.h) - Math.max(row.top, rect.y);
      if (overlap >= 0.5 * Math.min(rect.h, row.bottom - row.top)) {
        row.items.push(rect);
        row.top = Math.min(row.top, rect.y);
        row.bottom = Math.max(row.bottom, rect.y + rect.h);
        continue;
      }
    }
    rows.push({ top: rect.y, bottom: rect.y + rect.h, items: [rect] });
  }

  return rows.flatMap((row) => row.items.sort((a, b) => a.x - b.x));
}
