/**
 * One drawing of a fighter, put together the way the game does it: a layout
 * places 8×8 and 16×16 pieces of an unpacked tile set around the fighter's
 * origin. Checked against the OAM the game wrote for the same drawing.
 *
 * Tile n of a set is where the set lands in VRAM, 16 tiles to a row — so a
 * 16×16 piece at n is n, n+1, n+16, n+17, exactly as the PPU reads it. The
 * attribute byte keeps OAM's flip bits; flipping a 16×16 piece also swaps
 * which of its four tiles goes where, as on the hardware.
 */

import type { Rgba } from "../sprites/png";

export interface Piece {
  dx: number;
  dy: number;
  tile: number;
  big: boolean;
  hflip: boolean;
  vflip: boolean;
}

const END = 0x80;
/** OAM's name-table bit: the tile is on the second page, 0x100 on. Objects use it. */
const PAGE = 0x01;
const BIG = 0x10;
const HFLIP = 0x40;
const VFLIP = 0x80;

/** Four bytes per piece — dx, dy (signed), tile, attributes — until 0x80. */
export function readLayout(rom: Uint8Array, at: number): Piece[] {
  const pieces: Piece[] = [];
  for (let p = at; rom[p] !== END; p += 4) {
    if (pieces.length === 128) throw new Error(`layout at 0x${at.toString(16)} has no end`);
    const attr = rom[p + 3];
    // a bit not seen yet (a palette, a priority) would be drawn wrong, silently
    if (attr & ~(PAGE | BIG | HFLIP | VFLIP)) throw new Error(`layout at 0x${at.toString(16)}: unknown attribute 0x${attr.toString(16)}`);
    pieces.push({
      dx: signed(rom[p]),
      dy: signed(rom[p + 1]),
      tile: rom[p + 2] | (attr & PAGE ? 0x100 : 0),
      big: (attr & BIG) !== 0,
      hflip: (attr & HFLIP) !== 0,
      vflip: (attr & VFLIP) !== 0,
    });
  }
  return pieces;
}

/**
 * The whole drawing mirrored about the fighter's origin — what the game does
 * when the facing or a script's flip (field 0x14) sets OAM's flip bits: each
 * piece lands on the other side and flips itself.
 */
export function flipLayout(pieces: Piece[], h: boolean, v: boolean): Piece[] {
  return pieces.map((p) => {
    const size = p.big ? 16 : 8;
    return {
      ...p,
      dx: h ? -p.dx - size : p.dx,
      dy: v ? -p.dy - size : p.dy,
      hflip: p.hflip !== h,
      vflip: p.vflip !== v,
    };
  });
}

/** 16 BGR555 colours as RGB; colour 0 is transparent and stays so. */
export function readPalette(rom: Uint8Array, at: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const c = rom[at + 2 * i] | (rom[at + 2 * i + 1] << 8);
    out.push([(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3]);
  }
  return out;
}

/** Colour index of one pixel of 4bpp tile n: planes 0/1 then 2/3, 32 bytes. */
export function tilePixel(tiles: Uint8Array, n: number, x: number, y: number): number {
  const t = 32 * n;
  const bit = 7 - x;
  return (
    ((tiles[t + 2 * y] >> bit) & 1) |
    (((tiles[t + 2 * y + 1] >> bit) & 1) << 1) |
    (((tiles[t + 16 + 2 * y] >> bit) & 1) << 2) |
    (((tiles[t + 17 + 2 * y] >> bit) & 1) << 3)
  );
}

export interface Drawing {
  image: Rgba;
  /** Where the fighter's origin falls inside `image`. */
  origin: { x: number; y: number };
}

export function drawFrame(tiles: Uint8Array, pieces: Piece[], palette: [number, number, number][]): Drawing {
  if (pieces.length === 0) throw new Error("the layout has no pieces");
  const cells = pieces.flatMap((p) => {
    const span = p.big ? 1 : 0;
    return (p.big ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]).map(([cx, cy]) => ({
      x: p.dx + 8 * (p.hflip ? span - cx : cx),
      y: p.dy + 8 * (p.vflip ? span - cy : cy),
      tile: p.tile + cx + 16 * cy,
      hflip: p.hflip,
      vflip: p.vflip,
    }));
  });
  const left = Math.min(...cells.map((c) => c.x));
  const top = Math.min(...cells.map((c) => c.y));
  const width = Math.max(...cells.map((c) => c.x)) + 8 - left;
  const height = Math.max(...cells.map((c) => c.y)) + 8 - top;
  const data = new Uint8Array(width * height * 4);

  // the first piece is the first OAM slot, which the PPU draws on top: paint last
  for (const c of cells.slice().reverse()) {
    if (32 * (c.tile + 1) > tiles.length) throw new Error(`piece wants tile ${c.tile}, the set has ${tiles.length / 32}`);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const v = tilePixel(tiles, c.tile, c.hflip ? 7 - x : x, c.vflip ? 7 - y : y);
        if (v === 0) continue;
        const i = ((c.y - top + y) * width + (c.x - left + x)) * 4;
        data.set([...palette[v], 255], i);
      }
    }
  }
  return { image: { width, height, data }, origin: { x: -left, y: -top } };
}

function signed(b: number): number {
  return b < 0x80 ? b : b - 0x100;
}
