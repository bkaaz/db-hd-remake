/**
 * An arena, taken from the cartridge into the shape the game reads
 * (`arena/arenaFile.ts`): its layers, cut where they scroll differently,
 * drawn once per lighting. Which rows move apart is the arena's own handler,
 * read by hand (`rom.md`, How a stage's layers scroll) and written here.
 */

import type { ArenaFile } from "../arena/arenaFile";
import type { Rgba } from "../sprites/png";
import type { FighterTables } from "./cartridge";
import { paletteRecord } from "./resource";
import { BG1, BG2, drawLayer, loadStage, stack } from "./stage";

/** Each stage id's lighting, picking the fighters' palettes: `0x40` + 16 × character + this ($01:82B5). */
const LIGHTING = 0x8304;

/**
 * A fighter's palette in each lighting the arenas have that differs from
 * the one it is exported in — the palette the original loads for player one
 * on that stage. Named by the lighting, which is how the game asks for it.
 */
export function lightingPalettes(rom: Uint8Array, t: FighterTables): Record<string, number> {
  const out: Record<string, number> = {};
  for (const source of Object.values(ARENAS)) {
    for (const [time, stage] of Object.entries(source.ids)) {
      const { at } = paletteRecord(rom, 0x40 + 16 * t.character + (rom[LIGHTING + stage] & 0x0f));
      if (at === t.palette) continue;
      if (out[time] !== undefined && out[time] !== at) throw new Error(`two palettes are both "${time}"`);
      out[time] = at;
    }
  }
  return out;
}

/** How far the charging glow's palette is from the fighter's own ($0F:A072: field 0x17 + 8). */
const GLOW = 8;

/** His palette record in each lighting, named by it — null for the one he is exported in. */
function lightingRecords(rom: Uint8Array, t: FighterTables): [string | null, number][] {
  return Object.values(ARENAS).flatMap((source) =>
    Object.entries(source.ids).map(([time, stage]): [string | null, number] => {
      const own = 0x40 + 16 * t.character + (rom[LIGHTING + stage] & 0x0f);
      return [paletteRecord(rom, own).at === t.palette ? null : time, own];
    }),
  );
}

/** A variant's name: its lighting's, then what it adds (`night_glow`), or the addition alone. */
const named = (time: string | null, ...parts: string[]) => [time, ...parts].filter(Boolean).join("_");

/**
 * A fighter's glow while charging, in every lighting: `glow`, `evening_glow`
 * … — the record 8 past the palette that lighting gives him. None where
 * that record is his own palette again: Goku's 0x48–0x4F point at
 * 0x40–0x47's, so he never glows.
 */
export function glowPalettes(rom: Uint8Array, t: FighterTables): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [time, own] of lightingRecords(rom, t)) {
    const [plain, glow] = [paletteRecord(rom, own).at, paletteRecord(rom, own + GLOW).at];
    if (glow !== plain) out[named(time, "glow")] = glow;
  }
  return out;
}

/** How far the winning pose's palette is from the fighter's own (Vegeta's `3e`, $20:9257: field 0x17 + 0x98). */
const WIN = 0x98;

/**
 * A fighter's colours in his winning pose, in every lighting, player two's
 * too: `win`, `night_win`, `win_alt` … — the record 0x98 past the palette
 * that lighting gives him, as Vegeta's `3e` loads it.
 */
export function winPalettes(rom: Uint8Array, t: FighterTables): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [time, own] of lightingRecords(rom, t)) {
    for (const [name, record] of [[named(time, "win"), own + WIN], [named(time, "win", "alt"), own + 1 + WIN]] as const) {
      // past the table's end for Piccolo and Freeza, whose 3e loads none this way
      try {
        out[name] = paletteRecord(rom, record).at;
      } catch {
        continue;
      }
    }
  }
  return out;
}

/**
 * Player two's colours when both sides are the same fighter — the next
 * record ($01:82F2) — in every lighting, glowing too where he glows:
 * `alt`, `night_alt`, `glow_alt` …
 */
export function altPalettes(rom: Uint8Array, t: FighterTables): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [time, own] of lightingRecords(rom, t)) {
    out[named(time, "alt")] = paletteRecord(rom, own + 1).at;
    const [plain, glow] = [paletteRecord(rom, own + 1).at, paletteRecord(rom, own + 1 + GLOW).at];
    if (glow !== plain) out[named(time, "glow", "alt")] = glow;
  }
  return out;
}

interface ArenaSource {
  /** The stage id of each lighting, in the order `times` lists them. */
  ids: Record<string, number>;
  /**
   * BG1's tile rows above this scroll apart — the middle HDMA block ends on
   * world row 95 — at `camera x / 2 + 64` ($00:BCD9). Its top block, at the
   * camera's speed, lies under the HUD and is drawn with the sky.
   */
  skyRows: number;
}

/** Arena 0: the tournament (`rom.md`, A stage id). */
export const ARENAS: Record<string, ArenaSource> = {
  tournament: { ids: { day: 0, evening: 1, night: 2 }, skyRows: 12 },
};

export interface ExportedArena {
  file: ArenaFile;
  /** `<layer>@<time>` → its picture. */
  images: Record<string, Rgba>;
}

/**
 * Two layers: the sky, BG1 above `skyRows`, behind everything; and the rest
 * in mode 1's order — BG2's low tiles, BG1's, BG2's high. That the sky can go
 * first rests on BG2 having no low tiles beside it, which is checked.
 */
export function exportArena(rom: Uint8Array, source: ArenaSource): ExportedArena {
  const images: Record<string, Rgba> = {};
  const above: [number, number] = [0, source.skyRows];
  const below: [number, number] = [source.skyRows, 32];
  for (const [time, id] of Object.entries(source.ids)) {
    const stage = loadStage(rom, id);
    if (drawLayer(stage, BG2, { priority: "low", rows: above }).data.some((v, i) => i % 4 === 3 && v > 0)) {
      throw new Error(`stage ${id}: BG2 has low tiles beside the sky, which would then cover them`);
    }
    images[`sky@${time}`] = drawLayer(stage, BG1, { rows: above });
    images[`court@${time}`] = stack(
      drawLayer(stage, BG2, { priority: "low" }),
      drawLayer(stage, BG1, { priority: "low", rows: below }),
      drawLayer(stage, BG2, { priority: "high" }),
      drawLayer(stage, BG1, { priority: "high", rows: below }),
    );
  }
  return {
    file: {
      times: Object.keys(source.ids),
      layers: [
        { name: "sky", scroll: [0.5, 64] },
        { name: "court", scroll: [1, 0] },
      ],
    },
    images,
  };
}
