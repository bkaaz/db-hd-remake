import { state } from "./store";

/**
 * Owns the loaded sheet's pixels and produces a "keyed" canvas where the chosen
 * background color has been made transparent. The keyed canvas is the single
 * render/export source, so the sheet view, preview, and atlas export all show
 * the same transparency.
 *
 * Global color-key: every pixel matching the background color (within
 * tolerance) becomes transparent. Fine for flat pixel-art with no
 * anti-aliasing; may punch holes if that exact color also appears inside a
 * sprite (a flood-from-edges variant can be added later if needed).
 */

let sourceData: ImageData | null = null;
let keyed: HTMLCanvasElement | null = null;

/** Load a new image; returns whether it already contained transparency. */
export function setImage(img: HTMLImageElement): boolean {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  sourceData = ctx.getImageData(0, 0, img.width, img.height);

  keyed = document.createElement("canvas");
  keyed.width = img.width;
  keyed.height = img.height;

  const hasAlpha = imageHasTransparency(sourceData);
  rebuildKeyed();
  return hasAlpha;
}

function imageHasTransparency(data: ImageData): boolean {
  const d = data.data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 255) return true;
  }
  return false;
}

/** Set the background color from the source pixel at image coordinates. */
export function pickColorAt(ix: number, iy: number): void {
  if (!sourceData) return;
  const x = Math.floor(ix);
  const y = Math.floor(iy);
  if (x < 0 || y < 0 || x >= sourceData.width || y >= sourceData.height) return;
  const i = (y * sourceData.width + x) * 4;
  state.bgColor = [
    sourceData.data[i],
    sourceData.data[i + 1],
    sourceData.data[i + 2],
  ];
}

/** Regenerate the keyed canvas from the current bg color / tolerance / toggle. */
export function rebuildKeyed(): void {
  if (!sourceData || !keyed) return;
  const ctx = keyed.getContext("2d");
  if (!ctx) return;

  if (!state.bgKeyEnabled || !state.bgColor) {
    ctx.putImageData(sourceData, 0, 0);
    return;
  }

  const src = sourceData.data;
  const out = ctx.createImageData(sourceData.width, sourceData.height);
  const o = out.data;
  const [kr, kg, kb] = state.bgColor;
  const tol = state.bgTolerance;

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const a = src[i + 3];
    o[i] = r;
    o[i + 1] = g;
    o[i + 2] = b;
    const isBackground =
      a > 0 &&
      Math.abs(r - kr) <= tol &&
      Math.abs(g - kg) <= tol &&
      Math.abs(b - kb) <= tol;
    o[i + 3] = isBackground ? 0 : a;
  }
  ctx.putImageData(out, 0, 0);
}

/** The render/export source (keyed canvas), or null before an image loads. */
export function getSource(): HTMLCanvasElement | null {
  return keyed;
}
