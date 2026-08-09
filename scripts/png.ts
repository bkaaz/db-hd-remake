import { inflateSync } from "node:zlib";

/**
 * Just enough PNG decoding to read our own atlases.
 *
 * The atlas is produced by the editor's canvas, so it is always 8-bit
 * non-interlaced RGB(A) — no palettes, no 16-bit channels. Rather than take a
 * dependency for that one case, this decodes it with the built-in zlib and
 * refuses loudly on anything it was not built for, so an unexpected file fails
 * instead of being silently misread.
 */

export interface Rgba {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Paeth predictor (PNG spec 9.4). */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Reverse the per-scanline filters, in place, returning raw samples. */
function unfilter(raw: Buffer, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const row = y * stride;
    const prev = row - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[pos + i];
      const a = i >= bpp ? out[row + i - bpp] : 0;
      const b = y > 0 ? out[prev + i] : 0;
      const c = y > 0 && i >= bpp ? out[prev + i - bpp] : 0;
      let value: number;
      switch (filter) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + a;
          break;
        case 2:
          value = x + b;
          break;
        case 3:
          value = x + ((a + b) >> 1);
          break;
        case 4:
          value = x + paeth(a, b, c);
          break;
        default:
          throw new Error(`png: unknown row filter ${filter} on row ${y}`);
      }
      out[row + i] = value & 0xff;
    }
    pos += stride;
  }
  return out;
}

export function decodePng(buffer: Buffer): Rgba {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (buffer[i] !== SIGNATURE[i]) throw new Error("png: not a PNG file");
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  let pos = 8;
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length; // length + type + data + crc
  }

  if (bitDepth !== 8) throw new Error(`png: only 8-bit channels supported (got ${bitDepth})`);
  if (interlace !== 0) throw new Error("png: interlaced images are not supported");
  if (colorType !== 6 && colorType !== 2) {
    throw new Error(`png: only RGB/RGBA supported (colour type ${colorType})`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const samples = unfilter(inflateSync(Buffer.concat(idat)), width, height, channels);
  if (channels === 4) return { width, height, data: samples };

  // RGB → RGBA so callers only ever deal with one layout.
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < samples.length; i += 3, j += 4) {
    data[j] = samples[i];
    data[j + 1] = samples[i + 1];
    data[j + 2] = samples[i + 2];
    data[j + 3] = 255;
  }
  return { width, height, data };
}

/**
 * Opacity mask for a rectangle of an image: 1 where a pixel is not fully
 * transparent. This is the sprite's silhouette, which is what hurt boxes are
 * derived from.
 */
export function alphaMask(
  image: Rgba,
  rect: { x: number; y: number; w: number; h: number },
): Uint8Array {
  const mask = new Uint8Array(rect.w * rect.h);
  for (let y = 0; y < rect.h; y++) {
    const src = ((rect.y + y) * image.width + rect.x) * 4;
    for (let x = 0; x < rect.w; x++) {
      mask[y * rect.w + x] = image.data[src + x * 4 + 3] > 0 ? 1 : 0;
    }
  }
  return mask;
}
