/**
 * Render selected frames as a labelled contact sheet, so a person (or a model
 * with eyes) can look at the sprites and say what they are.
 *
 * The numbers are burnt into the image on purpose: "count from the left" is
 * exactly how a description ends up attached to the wrong frame.
 *
 *   npm run sheet -- goku --frames 0-30
 *   npm run sheet -- goku --frames 6,7,8 --scale 6 --cols 3
 *
 * Output goes to assets/contact/ — generated, gitignored, throwaway.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { encodePng, decodePng, type Rgba } from "../src/sprites/png.ts";
import type { FrameRect } from "../src/sprites/boxes.ts";

/** 3x5 pixel digits — enough to label a frame, nothing more. */
const DIGITS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

const BG: [number, number, number] = [0x28, 0x28, 0x30];
const CELL: [number, number, number] = [0x1a, 0x1a, 0x20];
const INK: [number, number, number] = [0xff, 0xff, 0xff];

function blank(width: number, height: number, colour: [number, number, number]): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = colour[0];
    data[i + 1] = colour[1];
    data[i + 2] = colour[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function fill(
  dst: Rgba,
  x0: number,
  y0: number,
  w: number,
  h: number,
  colour: [number, number, number],
): void {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= dst.height) continue;
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= dst.width) continue;
      const p = (y * dst.width + x) * 4;
      dst.data[p] = colour[0];
      dst.data[p + 1] = colour[1];
      dst.data[p + 2] = colour[2];
      dst.data[p + 3] = 255;
    }
  }
}

/** Nearest-neighbour blit of a source rect, scaled, skipping transparent pixels. */
function blit(dst: Rgba, src: Rgba, rect: FrameRect, dx: number, dy: number, scale: number): void {
  for (let y = 0; y < rect.h * scale; y++) {
    const sy = rect.y + Math.floor(y / scale);
    for (let x = 0; x < rect.w * scale; x++) {
      const sx = rect.x + Math.floor(x / scale);
      const s = (sy * src.width + sx) * 4;
      if (src.data[s + 3] === 0) continue;
      const d = ((dy + y) * dst.width + dx + x) * 4;
      if (d < 0 || d + 3 >= dst.data.length) continue;
      dst.data[d] = src.data[s];
      dst.data[d + 1] = src.data[s + 1];
      dst.data[d + 2] = src.data[s + 2];
      dst.data[d + 3] = 255;
    }
  }
}

function drawLabel(dst: Rgba, text: string, x: number, y: number, scale: number): void {
  let cursor = x;
  for (const ch of text) {
    const glyph = DIGITS[ch];
    if (!glyph) {
      cursor += 2 * scale;
      continue;
    }
    glyph.forEach((row, gy) => {
      [...row].forEach((on, gx) => {
        if (on === "1") fill(dst, cursor + gx * scale, y + gy * scale, scale, scale, INK);
      });
    });
    cursor += 4 * scale;
  }
}

/** "0-30" or "1,4,9" or a mix. */
function parseFrames(spec: string): string[] {
  const out: string[] = [];
  for (const part of spec.split(",")) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      for (let i = Number(range[1]); i <= Number(range[2]); i++) out.push(String(i));
    } else if (part.trim()) {
      out.push(part.trim());
    }
  }
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let entity = "";
  let spec = "";
  let cols = 4;
  let scale = 4;
  let perSheet = 16;

  for (let i = 0; i < argv.length; i++) {
    const next = (): string => argv[++i] ?? "";
    switch (argv[i]) {
      case "--frames": spec = next(); break;
      case "--cols": cols = Number(next()); break;
      case "--scale": scale = Number(next()); break;
      case "--per-sheet": perSheet = Number(next()); break;
      default: entity = argv[i];
    }
  }
  if (!entity || !spec) {
    console.error("usage: sheet <entity> --frames 0-30 [--cols 4] [--scale 4] [--per-sheet 16]");
    process.exit(1);
  }

  const root = process.cwd();
  const frames = JSON.parse(
    await fs.readFile(path.join(root, "data", "entities", entity, "frames.json"), "utf8"),
  ) as Record<string, FrameRect>;
  const atlas = decodePng(await fs.readFile(path.join(root, "assets", "atlases", `${entity}.png`)));

  const ids = parseFrames(spec).filter((id) => {
    if (frames[id]) return true;
    console.log(`  skipping ${id}: no such frame`);
    return false;
  });
  if (ids.length === 0) return;

  const outDir = path.join(root, "assets", "contact");
  await fs.mkdir(outDir, { recursive: true });
  const written: string[] = [];

  for (let start = 0; start < ids.length; start += perSheet) {
    const batch = ids.slice(start, start + perSheet);
    const cellW = Math.max(...batch.map((id) => frames[id].w)) * scale + 8;
    const cellH = Math.max(...batch.map((id) => frames[id].h)) * scale + 8;
    const labelH = 7 * scale;
    const rows = Math.ceil(batch.length / cols);
    const sheet = blank(cols * cellW, rows * (cellH + labelH), BG);

    batch.forEach((id, i) => {
      const rect = frames[id];
      const cx = (i % cols) * cellW;
      const cy = Math.floor(i / cols) * (cellH + labelH);
      fill(sheet, cx + 1, cy + 1, cellW - 2, cellH - 2, CELL);
      // Bottom-centre the sprite in its cell, so poses share a ground line.
      blit(
        sheet,
        atlas,
        rect,
        cx + Math.round((cellW - rect.w * scale) / 2),
        cy + cellH - 4 - rect.h * scale,
        scale,
      );
      drawLabel(sheet, id, cx + 4, cy + cellH + 2, scale);
    });

    const file = path.join(outDir, `${entity}-${batch[0]}-${batch[batch.length - 1]}.png`);
    await fs.writeFile(file, encodePng(sheet));
    written.push(path.relative(root, file));
  }

  console.log(`${ids.length} frames -> ${written.length} sheet(s)`);
  for (const f of written) console.log(`  ${f}`);
}

void main();
