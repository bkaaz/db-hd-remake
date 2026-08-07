import { getKeyedImageData } from "./imageProcess";

/**
 * Auto-detects sprite frames from the keyed sheet: transparent pixels are gaps,
 * connected opaque regions are sprites. Each region's bounding box becomes a
 * frame.
 *
 * `gap` closes small transparent seams so a sprite split by a few transparent
 * pixels stays one frame — implemented as a dilation of radius floor(gap/2)
 * before labeling (two fragments separated by up to `gap` px merge). Bounding
 * boxes are still measured from the *original* opaque pixels, so they stay tight
 * to the real sprite. `minSide` drops a frame whose width OR height is below it
 * (kills 1px slivers and small noise). Applies to "detect all" only — a magic
 * click is explicit and always makes a frame.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DetectOptions {
  gap: number;
  minSide: number;
}

interface Mask {
  w: number;
  h: number;
  fg: Uint8Array; // 1 = opaque (foreground)
  dil: Uint8Array; // fg dilated by floor(gap/2), used for connectivity
}

function buildMask(gap: number): Mask | null {
  const data = getKeyedImageData();
  if (!data) return null;
  const w = data.width;
  const h = data.height;
  const fg = new Uint8Array(w * h);
  const d = data.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    fg[p] = d[i + 3] > 0 ? 1 : 0;
  }
  const r = Math.max(0, Math.floor(gap / 2));
  const dil = r === 0 ? fg.slice() : dilate(fg, w, h, r);
  return { w, h, fg, dil };
}

/** Separable max filter (dilation) with Chebyshev radius r. */
function dilate(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < w && src[row + xx]) {
          v = 1;
          break;
        }
      }
      tmp[row + x] = v;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy >= 0 && yy < h && tmp[yy * w + x]) {
          v = 1;
          break;
        }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Flood a connected region of the dilated mask; bbox measured over fg pixels. */
function floodBBox(
  mask: Mask,
  start: number,
  labels: Int32Array,
  label: number,
): Rect | null {
  const { w, h, fg, dil } = mask;
  const stack: number[] = [start];
  labels[start] = label;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let area = 0;

  while (stack.length) {
    const p = stack.pop() as number;
    const px = p % w;
    const py = (p / w) | 0;
    if (fg[p]) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
      area++;
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (dil[np] && labels[np] === 0) {
          labels[np] = label;
          stack.push(np);
        }
      }
    }
  }

  if (maxX < minX || area === 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, };
}

/** Detect all sprite frames in the sheet, in reading order. */
export function detectAll(opts: DetectOptions): Rect[] {
  const mask = buildMask(opts.gap);
  if (!mask) return [];
  const labels = new Int32Array(mask.dil.length);
  const rects: Rect[] = [];
  let label = 0;

  for (let start = 0; start < mask.dil.length; start++) {
    if (!mask.dil[start] || labels[start] !== 0) continue;
    label++;
    const rect = floodBBox(mask, start, labels, label);
    if (rect && rect.w >= opts.minSide && rect.h >= opts.minSide) rects.push(rect);
  }

  rects.sort((a, b) => a.y - b.y || a.x - b.x);
  return rects;
}

/** Detect the single sprite frame under the given image-space point. */
export function detectAt(ix: number, iy: number, opts: DetectOptions): Rect | null {
  const mask = buildMask(opts.gap);
  if (!mask) return null;
  const sx = Math.floor(ix);
  const sy = Math.floor(iy);
  if (sx < 0 || sy < 0 || sx >= mask.w || sy >= mask.h) return null;
  const start = sy * mask.w + sx;
  if (!mask.dil[start]) return null; // clicked on background
  const labels = new Int32Array(mask.dil.length);
  // Magic click is explicit — always return the clicked region (min not applied).
  return floodBBox(mask, start, labels, 1);
}
