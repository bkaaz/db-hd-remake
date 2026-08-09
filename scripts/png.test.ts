import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { alphaMask, decodePng } from "./png";

/**
 * The decoder is hand-rolled, so it is tested by round-trip: encode a known
 * image here with each of PNG's five row filters, then decode it back. That
 * exercises the filter reversal, which is the only part with real bug surface.
 */

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
}

/** Encode RGBA pixels, applying one filter type to every row. */
function encodePng(width: number, height: number, rgba: number[], filter: 0 | 1 | 2 | 3 | 4): Buffer {
  const bpp = 4;
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const out = y * (stride + 1);
    raw[out] = filter;
    for (let i = 0; i < stride; i++) {
      const x = rgba[y * stride + i];
      const a = i >= bpp ? rgba[y * stride + i - bpp] : 0;
      const b = y > 0 ? rgba[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= bpp ? rgba[(y - 1) * stride + i - bpp] : 0;
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x - a; break;
        case 2: v = x - b; break;
        case 3: v = x - ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = x - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
      }
      raw[out + 1 + i] = v & 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 3x2 image: red, green, transparent / blue, transparent, white. */
const W = 3;
const H = 2;
const PIXELS = [
  255, 0, 0, 255, 0, 255, 0, 255, 9, 9, 9, 0,
  0, 0, 255, 255, 1, 2, 3, 0, 255, 255, 255, 255,
];

describe("decodePng", () => {
  for (const filter of [0, 1, 2, 3, 4] as const) {
    it(`round-trips pixels through row filter ${filter}`, () => {
      const image = decodePng(encodePng(W, H, PIXELS, filter));
      expect(image.width).toBe(W);
      expect(image.height).toBe(H);
      expect([...image.data]).toEqual(PIXELS);
    });
  }

  it("rejects a file that is not a PNG", () => {
    expect(() => decodePng(Buffer.from("definitely not a png"))).toThrow(/not a PNG/);
  });
});

describe("alphaMask", () => {
  it("marks the pixels that are not fully transparent", () => {
    const image = decodePng(encodePng(W, H, PIXELS, 0));
    expect([...alphaMask(image, { x: 0, y: 0, w: W, h: H })]).toEqual([1, 1, 0, 1, 0, 1]);
  });

  it("reads only the requested rectangle", () => {
    const image = decodePng(encodePng(W, H, PIXELS, 4));
    // Bottom-left 2x1: blue (opaque), then a transparent pixel.
    expect([...alphaMask(image, { x: 0, y: 1, w: 2, h: 1 })]).toEqual([1, 0]);
  });
});
