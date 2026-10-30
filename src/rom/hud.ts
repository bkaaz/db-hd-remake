/**
 * The original's HUD ($00:C430): BG3, 2 bits a pixel, tiles from resource
 * 0x0F at VRAM $3000, a 32×32 map packed at $00:A441 for $3800, palette
 * record 0x0F from colour 0. `drawHud` draws the map as the loader leaves
 * it; `exportHud` cuts it into what the game puts together each frame
 * (`hud/hudFile.ts`) — the fight only rewrites tile numbers in cells whose
 * colours and flips the map already holds, so each part's tiles are drawn
 * in its own cells' attributes.
 */

import type { Cell, HudFile } from "../hud/hudFile";
import type { Rgba } from "../sprites/png";
import { lzss } from "./lzss";
import { cpuPalette, cpuResource } from "./resource";

const TILES = 0x0f;
/** $00:A441, LoROM bank 0. */
const MAP = 0x2441;
const PALETTE = 0x0f;
/** Nine tile numbers per character ($00:C4B5). */
const NAMES = 0x4511;
/** The bar's tiles by px filled: $00:C6C9, $00:C6CF, $00:C6D8. */
const BAR = { first: [0x46c9, 6], middle: [0x46cf, 9], last: [0x46d8, 6] } as const;
/**
 * The bar's colour 2, BGR555, set each frame ($00:C6DE, immediates in its
 * code): yellow from 81 up; below, a 12-frame cycle of the game's frame
 * count, 3 frames each — dark red, yellow, orange, red.
 */
const BAR_COLOURS = [0x37ff, 0x000c, 0x0abf, 0x00dc];
const BAR_FLASH = { below: 0x51, hold: 3, cycle: [1, 0, 2, 3] };
/** The band's rows, and how many of its lines the original blacks out under it (screenshots). */
const BAND_ROWS = 4;
const BLACK = 31;
/** Tiles drawn per part's row: every tile the parts use is below this. */
const GLYPHS = 128;

interface Hud {
  tiles: Uint8Array;
  map: Uint8Array;
  colours: number[][];
}

function readHud(rom: Uint8Array): Hud {
  const cg = cpuPalette(rom, PALETTE);
  const colours = Array.from({ length: cg.length / 2 }, (_, i) => bgr(cg[2 * i] | (cg[2 * i + 1] << 8)));
  return { tiles: cpuResource(rom, TILES), map: lzss(rom, MAP), colours };
}

function bgr(c: number): number[] {
  return [(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3, 255];
}

function cell(hud: Hud, col: number, row: number): number {
  const at = 2 * (row * 32 + col);
  return hud.map[at] | (hud.map[at + 1] << 8);
}

/** Colour index of one pixel of 2bpp tile n: planes 0 and 1 interleaved, 16 bytes. */
function pixel2(tiles: Uint8Array, n: number, x: number, y: number): number {
  const t = 16 * n + 2 * y;
  const bit = 7 - x;
  return ((tiles[t] >> bit) & 1) | (((tiles[t + 1] >> bit) & 1) << 1);
}

/**
 * One map entry's tile, in its palette and flips, at (x, y) of `img`; colour
 * 0 left as it is, colour 2 replaced by `colour2` (BGR555) when given.
 */
function drawTile(hud: Hud, entry: number, img: Rgba, x0: number, y0: number, colour2?: number): void {
  const [tile, pal, h, v] = [entry & 0x3ff, (entry >> 10) & 7, entry & 0x4000, entry & 0x8000];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = pixel2(hud.tiles, tile, h ? 7 - x : x, v ? 7 - y : y);
      if (!i) continue;
      const rgba = i === 2 && colour2 !== undefined ? bgr(colour2) : hud.colours[4 * pal + i];
      img.data.set(rgba, ((y0 + y) * img.width + x0 + x) * 4);
    }
  }
}

/** The whole map as the loader leaves it, for a person to look at. */
export function drawHud(rom: Uint8Array): Rgba {
  const hud = readHud(rom);
  const img = { width: 256, height: 256, data: new Uint8Array(256 * 256 * 4) };
  for (let row = 0; row < 32; row++) for (let col = 0; col < 32; col++) drawTile(hud, cell(hud, col, row), img, 8 * col, 8 * row);
  return img;
}

/**
 * The cells the fight rewrites, as its code addresses them in the map's copy
 * at $7F:7000 ($00:C57D, $00:C4A5): each part's first cell per player, and
 * how many it spans.
 */
const LAYOUT = {
  number: { at: [[1, 2], [28, 2]] as [Cell, Cell], cols: 3, rows: 2 },
  bar: { at: [[5, 2], [17, 2]] as [Cell, Cell], cols: 10, rows: 1 },
  name: { at: [[6, 3], [17, 3]] as [Cell, Cell], cols: 9, rows: 1 },
};
/** The first digit's tile ($00:C60A). */
const DIGITS = 0x3e;
/**
 * The dial's first tile and its cells, in tile order ($00:C731): player
 * one's top at row 2 column 4 and two below; player two's laid out mirrored
 * by the swap at $00:C74E.
 */
const DIAL = {
  tile: 0x17,
  cells: [
    [[4, 2], [4, 3], [5, 3]],
    [[27, 2], [27, 3], [26, 3]],
  ] as [[Cell, Cell, Cell], [Cell, Cell, Cell]],
};

/**
 * The band with every rewritten cell left empty, then a row of tiles for
 * each part in that part's cells' attributes; and where they go. `fighters`
 * names the characters whose names to take, by our entity name.
 */
export function exportHud(rom: Uint8Array, fighters: Record<string, number>): { image: Rgba; file: HudFile } {
  const hud = readHud(rom);
  const width = 8 * GLYPHS;
  // a row each for the numbers and names, then the two bars in each of their colours
  const rows = { number: 32, name: 40, bar: BAR_COLOURS.map((_, k): [number, number] => [48 + 16 * k, 56 + 16 * k]) };
  const height = 48 + 16 * BAR_COLOURS.length;
  const img: Rgba = { width, height, data: new Uint8Array(width * height * 4) };

  // the band: black where the original hides the arena, the map's tiles over it
  for (let y = 0; y < BLACK; y++) for (let x = 0; x < 256; x++) img.data.set([0, 0, 0, 255], (y * width + x) * 4);
  // which attributes each part's cells hold — one per part and player, or the cut is wrong
  const rewritten = new Set<string>();
  const attributes = (part: keyof typeof LAYOUT, player: 0 | 1): number => {
    const { at, cols, rows: tall } = LAYOUT[part];
    const seen = new Set<number>();
    for (let r = 0; r < tall; r++) {
      for (let c = 0; c < cols; c++) {
        rewritten.add(`${at[player][0] + c},${at[player][1] + r}`);
        seen.add(cell(hud, at[player][0] + c, at[player][1] + r) & 0xfc00);
      }
    }
    if (seen.size !== 1) throw new Error(`the HUD's ${part} cells differ in colour or flip`);
    return [...seen][0];
  };
  const parts: [number, number, number?][] = [
    [rows.number, attributes("number", 0)],
    [rows.name, attributes("name", 0)],
    ...rows.bar.flatMap(([left, right], k): [number, number, number][] => [
      [left, attributes("bar", 0), BAR_COLOURS[k]],
      [right, attributes("bar", 1), BAR_COLOURS[k]],
    ]),
  ];
  if (attributes("number", 1) !== parts[0][1] || attributes("name", 1) !== parts[1][1]) {
    throw new Error("the HUD's two players' numbers or names differ in colour");
  }
  DIAL.cells.forEach((cells, player) => {
    for (const [col, row] of cells) {
      rewritten.add(`${col},${row}`);
      if ((cell(hud, col, row) & 0xfc00) !== parts[2 + player][1]) throw new Error("the HUD's dial is not in its bar's colours");
    }
  });
  for (const [y, attr, colour] of parts) for (let t = 0; t < GLYPHS; t++) drawTile(hud, attr | t, img, 8 * t, y, colour);
  for (let row = 0; row < BAND_ROWS; row++) {
    for (let col = 0; col < 32; col++) if (!rewritten.has(`${col},${row}`)) drawTile(hud, cell(hud, col, row), img, 8 * col, 8 * row);
  }

  const table = ([at, n]: readonly [number, number]) => [...rom.subarray(at, at + n)];
  const names = Object.fromEntries(Object.entries(fighters).map(([name, c]) => [name, table([NAMES + 9 * c, 9])]));
  return {
    image: img,
    file: {
      band: 8 * BAND_ROWS,
      black: BLACK,
      rows,
      number: { tile: DIGITS, at: LAYOUT.number.at },
      bar: {
        first: table(BAR.first),
        middle: table(BAR.middle),
        last: table(BAR.last),
        at: LAYOUT.bar.at,
        flash: BAR_FLASH,
      },
      name: { at: LAYOUT.name.at },
      dial: DIAL,
      names,
    },
  };
}
