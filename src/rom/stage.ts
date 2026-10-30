/**
 * A stage as the S-CPU loads it ($00:B683): its record says which tiles go
 * to VRAM $0000, which map to $4000, which palette to colours 32 on, and
 * the BG mode and map size. Drawn here as flat layers, without the scroll
 * handlers that bend them on screen (`rom.md`, The camera) — for a person
 * to look at, and later for the export.
 */

import { pointer } from "./cartridge";
import { lzss } from "./lzss";
import { cpuPalette, cpuResource } from "./resource";
import { tilePixel } from "./frame";
import type { Rgba } from "../sprites/png";

/** 9 bytes per stage id, found through $00:BBC4. */
const STAGES = 0x3be0;
export const STAGE_COUNT = 18;

export interface StageRecord {
  /** Tile resource, loaded to VRAM $0000. */
  tiles: number;
  /** Palette record, loaded from colour 32 — the lighting. */
  palette: number;
  /** ROM offset of the packed maps, loaded to VRAM $4000. */
  maps: number;
  /** BG mode (byte 7, low 3 bits — the `$2105` shadow `$0509`). */
  mode: number;
  /** Maps 64 tiles wide rather than 32 (byte 7, bit 4). */
  wide: boolean;
  /** The arena: ids sharing it differ in lighting. */
  arena: number;
}

export function stageRecord(rom: Uint8Array, id: number): StageRecord {
  const at = STAGES + 9 * id;
  return {
    tiles: rom[at] | (rom[at + 1] << 8),
    palette: rom[at + 2] | (rom[at + 3] << 8),
    maps: pointer(rom, at + 4),
    mode: rom[at + 7] & 7,
    wide: (rom[at + 7] & 0x10) !== 0,
    arena: rom[at + 8],
  };
}

export interface LoadedStage {
  record: StageRecord;
  /** 64 KB, byte-addressed: VRAM word w is at 2w. */
  vram: Uint8Array;
  /** 256 colours as RGB; only what the stage loads is filled. */
  colours: [number, number, number][];
}

export function loadStage(rom: Uint8Array, id: number): LoadedStage {
  const record = stageRecord(rom, id);
  const vram = new Uint8Array(0x10000);
  vram.set(cpuResource(rom, record.tiles), 0);
  vram.set(lzss(rom, record.maps), 0x4000 * 2);
  const colours: [number, number, number][] = Array.from({ length: 256 }, () => [0, 0, 0]);
  const cg = cpuPalette(rom, record.palette);
  const first = id === 12 ? 48 : 32; // $00:B6D2
  for (let i = 0; 2 * i + 1 < cg.length && first + i < 256; i++) {
    const c = cg[2 * i] | (cg[2 * i + 1] << 8);
    colours[first + i] = [(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3];
  }
  return { record, vram, colours };
}

/** Which of a layer's tiles to draw: by their priority bit, and by tile row. */
export interface LayerPart {
  priority?: "high" | "low";
  /** From this tile row, up to and not including the second. */
  rows?: [number, number];
}

/** Where BG1's and BG2's maps start in VRAM, in words — `$050B` / `$050C`. */
export const BG1 = 0x4000;
export const BG2 = 0x4800;

/**
 * One 4bpp layer whose map starts at VRAM word `map`, tiles at word 0 (the
 * game sets `$210B` to 0): the whole map or the `part` asked for, colour 0
 * of each palette clear.
 */
export function drawLayer(stage: LoadedStage, map: number, part: LayerPart = {}): Rgba {
  const [firstRow, endRow] = part.rows ?? [0, 32];
  const cols = stage.record.wide ? 64 : 32;
  const width = cols * 8;
  const height = 32 * 8;
  const data = new Uint8Array(width * height * 4);
  for (let ty = 0; ty < 32; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      // a 64-wide map is two 32×32 screens side by side
      const word = map + (tx >= 32 ? 0x400 : 0) + ty * 32 + (tx & 31);
      const entry = stage.vram[2 * word] | (stage.vram[2 * word + 1] << 8);
      const tile = entry & 0x3ff;
      const palette = (entry >> 10) & 7;
      const hflip = (entry & 0x4000) !== 0;
      const vflip = (entry & 0x8000) !== 0;
      if (part.priority && (entry & 0x2000 ? "high" : "low") !== part.priority) continue;
      if (ty < firstRow || ty >= endRow) continue;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const index = tilePixel(stage.vram, tile, hflip ? 7 - x : x, vflip ? 7 - y : y);
          if (index === 0) continue;
          const [r, g, b] = stage.colours[16 * palette + index];
          data.set([r, g, b, 255], ((ty * 8 + y) * width + tx * 8 + x) * 4);
        }
      }
    }
  }
  return { width, height, data };
}

/** Layers drawn back to front, each where it is not clear. */
export function stack(...layers: Rgba[]): Rgba {
  const [first, ...rest] = layers;
  const data = Uint8Array.from(first.data);
  for (const over of rest) {
    for (let i = 0; i < data.length; i += 4) {
      if (over.data[i + 3]) data.set(over.data.subarray(i, i + 4), i);
    }
  }
  return { width: first.width, height: first.height, data };
}

/**
 * The two layers as mode 1 orders them, back to front ($2105 bit 3 clear):
 * BG2's low tiles, BG1's low, BG2's high, BG1's high.
 */
export function drawStage(stage: LoadedStage): Rgba {
  return stack(
    drawLayer(stage, BG2, { priority: "low" }),
    drawLayer(stage, BG1, { priority: "low" }),
    drawLayer(stage, BG2, { priority: "high" }),
    drawLayer(stage, BG1, { priority: "high" }),
  );
}
