/**
 * An arena, taken from the cartridge into the shape the game reads
 * (`arena/arenaFile.ts`): its layers, cut where they scroll differently,
 * drawn once per lighting. Which rows move apart is the arena's own handler,
 * read by hand (`rom.md`, How a stage's layers scroll) and written here.
 */

import type { ArenaFile, PaletteCycle } from "../arena/arenaFile";
import type { Rgba } from "../sprites/png";
import { toFile, type FighterTables } from "./cartridge";
import { paletteRecord } from "./resource";
import { BG1, BG2, drawLayer, loadStage, numberLayer, stack, type LayerPart } from "./stage";
import { readPalette } from "./frame";
import type { Rgb } from "../entity/palettesFile";

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

/**
 * How many records past the one he is exported in each lighting puts his own
 * palette — and with it a palette loaded as his own + k (field 0x17), an
 * object's in his colours (Earth Stab's leg, Goten and Trunks).
 */
export function lightingShifts(rom: Uint8Array, t: FighterTables): Record<string, number> {
  const records = lightingRecords(rom, t);
  const base = records.find(([time]) => time === null)?.[1];
  if (base === undefined) throw new Error("no lighting gives the palette he is exported in");
  return Object.fromEntries(records.flatMap(([time, own]) => (time === null ? [] : [[time, own - base]])));
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

/** How far past his own, in every lighting and for each player, the record his handler flashes him in: Cell's `a5`, `ac` and `ad` ($10:C5EA, $10:C9F1). */
const FLASH: Record<number, number> = { 7: 0x48 };

/** `flash`, `flash_alt`, `night_flash` … */
export function flashPalettes(rom: Uint8Array, t: FighterTables): Record<string, number> {
  const offset = FLASH[t.character];
  if (offset === undefined) return {};
  const out: Record<string, number> = {};
  for (const [time, own] of lightingRecords(rom, t)) {
    out[named(time, "flash")] = paletteRecord(rom, own + offset).at;
    out[named(time, "flash", "alt")] = paletteRecord(rom, own + 1 + offset).at;
  }
  return out;
}

/** Palette records a fighter's handler puts him in, as sheets of their own: Gohan's `ae` ($20:B417, $20:B421) and `3c` ($20:A4AA). */
const RUNS: Record<number, number[]> = { 3: [0x139, 0x135, 0x137, 0x158, 0x160, 0x168], 2: [0x140, 0x141, 0x142, 0x143, 0x144, 0x117], 6: [0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5], 7: [0x14b, 0x148, 0x149, 0x14a] };

/** Named records beside them: Freeza's Flaming Headbutt, by frame, player two's own in a mirror ($10:BC84). */
const NAMED_RUNS: Record<number, Record<string, number>> = { 6: { flame0: 0x126, flame1: 0x127, flame0_alt: 0x128, flame1_alt: 0x129 } };

/** `run0` … by the record's place in `RUNS`, keyed by character. */
export function runPalettes(rom: Uint8Array, t: FighterTables): Record<string, number> {
  const named = Object.entries(NAMED_RUNS[t.character] ?? {}).map(([name, id]) => [name, paletteRecord(rom, id).at]);
  return Object.fromEntries([...(RUNS[t.character] ?? []).map((id, i) => [`run${i}`, paletteRecord(rom, id).at]), ...named]);
}

/** How far a move's palette for the screen before the fight is from his own: Vegetto's `3c` is his black hair ($20:D912), Piccolo's his bare arms ($20:D9CF), and his `3e` too. */
const INTRO_RECORD: Record<number, number> = { 4: 0xae, 5: 0xc0 };

/** Which of a fighter's `RUNS` his intro plays, records that name no player: all of Freeza's (`$10:B06C`), Gohan's last (`$20:A4AA`). */
const ABSOLUTE_INTRO: Record<number, number[]> = { 6: [0, 1, 2, 3, 4, 5], 2: [5], 7: [0, 1, 2, 3] };

/** How far past his own the records his intro ends through: Cell's `fade0`, `fade1` ($10:C235, $10:C24F). */
const INTRO_FADES: Record<number, number[]> = { 7: [0x9c, 0x9e] };

/** What takes one palette's colours to another's: each channel's commonest difference, so that a colour at its limit does not count. */
export function lightingShift(day: readonly Rgb[], lit: readonly Rgb[]): Rgb {
  const commonest = (channel: number): number => {
    const counts = new Map<number, number>();
    day.forEach((c, i) => {
      if (i > 0) counts.set(lit[i][channel] - c[channel], (counts.get(lit[i][channel] - c[channel]) ?? 0) + 1);
    });
    return [...counts].sort((a, b) => b[1] - a[1])[0][0];
  };
  return [commonest(0), commonest(1), commonest(2)];
}

/** `lit` with the colours `run` changes from `day`, in `lit`'s light. */
export function relitRun(day: readonly Rgb[], run: readonly Rgb[], lit: readonly Rgb[]): Rgb[] {
  const shift = lightingShift(day, lit);
  const same = (a: Rgb, b: Rgb) => a.every((v, i) => v === b[i]);
  return lit.map((c, i) => (same(day[i], run[i]) ? c : (run[i].map((v, k) => Math.max(0, Math.min(248, v + shift[k]))) as unknown as Rgb)));
}

/**
 * His palettes for the intro in every lighting and in player two's colours:
 * `run0`, `run0_alt`, `evening_run0` … The original plays it on a screen of its
 * own, by day ($02:A242); only the day's record is his, as own + 0xAE by evening
 * is the Kamehameha's beam. Ours plays on the arena, so the rest are worked out.
 */
export function introPalettes(rom: Uint8Array, t: FighterTables): Record<string, number | Rgb[]> {
  const colours = (record: number) => readPalette(rom, paletteRecord(rom, record).at);
  const out: Record<string, number | Rgb[]> = {};
  const day = 0x40 + 16 * t.character;
  // absolute records, one set for both players ($10:B06C): `run0` … by day are `runPalettes`'
  for (const [time, own] of lightingRecords(rom, t)) {
    if (time === null) continue;
    for (const i of ABSOLUTE_INTRO[t.character] ?? []) {
      out[named(time, `run${i}`)] = relitRun(colours(day), colours(RUNS[t.character][i]), colours(own));
    }
  }
  for (const [i, past] of (INTRO_FADES[t.character] ?? []).entries()) {
    for (const [time, own] of lightingRecords(rom, t)) {
      for (const [side, parts] of [[0, [`fade${i}`]], [1, [`fade${i}`, "alt"]]] as const) {
        const name = named(time, ...parts);
        out[name] = time === null ? paletteRecord(rom, day + side + past).at : relitRun(colours(day + side), colours(day + side + past), colours(own + side));
      }
    }
  }
  const offset = INTRO_RECORD[t.character];
  if (offset === undefined) return out;
  for (const [time, own] of lightingRecords(rom, t)) {
    for (const [side, parts] of [[0, ["run0"]], [1, ["run0", "alt"]]] as const) {
      const name = named(time, ...parts);
      out[name] = time === null ? paletteRecord(rom, day + side + offset).at : relitRun(colours(day + side), colours(day + side + offset), colours(own + side));
    }
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

/** One picture of an arena: how it scrolls (`arena/arenaFile.ts`) and what it is drawn from, back to front. */
interface LayerSource {
  name: string;
  scroll: [number, number];
  draw: [map: number, part?: LayerPart][];
}

/** A palette stepping by itself (`rom.md`, An arena's palettes step by themselves): where its steps are, by lighting. */
interface CycleSource extends PaletteCycle {
  at: Record<string, number>;
}

interface ArenaSource {
  /** The stage id of each lighting, in the order `times` lists them. */
  ids: Record<string, number>;
  layers: LayerSource[];
  cycles?: CycleSource[];
  /** What the stage has and ours leaves out on purpose (`combat.md`, Where the fight happens), over all the layers. */
  leftOut?: LayerSource["draw"];
}

/** BG1's tile rows above this scroll apart on the tournament: the middle HDMA block ends on world row 95 (`rom.md`). */
const TOURNAMENT_SKY: [number, number] = [0, 12];
const TOURNAMENT_REST: [number, number] = [12, 32];

/** BG2's tile rows `$00:BEAA` keeps at half speed; the silhouettes below go double (`rom.md`). */
const FAR_ROWS: [number, number] = [0, 20];
const FRONT_ROWS: [number, number] = [20, 32];

/** How long the storm's palettes stand on each of their steps: `$00:C41F`[step] + 1. */
const STORM_HOLD = [2, 2, 2, 2, 2, 2, 4, 24, 12, 12, 12, 12, 12, 12, 12, 180];

/** What each arena's handler scrolls apart (`rom.md`, A stage id and The other arenas' layers). */
export const ARENAS: Record<string, ArenaSource> = {
  tournament: {
    ids: { day: 0, evening: 1, night: 2 },
    layers: [
      { name: "sky", scroll: [0.5, 64], draw: [[BG1, { rows: TOURNAMENT_SKY }]] },
      {
        name: "court",
        scroll: [1, 0],
        draw: [
          [BG2, { priority: "low" }],
          [BG1, { priority: "low", rows: TOURNAMENT_REST }],
          [BG2, { priority: "high" }],
          [BG1, { priority: "high", rows: TOURNAMENT_REST }],
        ],
      },
    ],
  },
  palace: {
    ids: { day: 9, evening: 10, night: 11 },
    layers: [
      { name: "sky", scroll: [0.25, 96], draw: [[BG2]] },
      { name: "palace", scroll: [1, 0], draw: [[BG1]] },
    ],
  },
  plains: {
    ids: { day: 13, evening: 14, night: 15 },
    layers: [
      { name: "sky", scroll: [0.5, 64], draw: [[BG2, { rows: FAR_ROWS }]] },
      { name: "plains", scroll: [1, 0], draw: [[BG1]] },
    ],
    leftOut: [[BG2, { rows: FRONT_ROWS }]],
    cycles: [
      // $0576 is whatever it was left at (recorded: 158): 16 is the step the day's own palette is
      { palette: 4, steps: 32, start: 16, hold: 16, at: { day: 0x9d8080, evening: 0x9d8500, night: 0x9d8980 } },
    ],
  },
  shore: {
    ids: { night: 17 },
    layers: [
      { name: "sky", scroll: [0.5, 64], draw: [[BG2, { rows: FAR_ROWS }]] },
      { name: "shore", scroll: [1, 0], draw: [[BG1]] },
    ],
    leftOut: [[BG2, { rows: FRONT_ROWS }]],
    cycles: [
      { palette: 2, steps: 16, start: 0, hold: STORM_HOLD, at: { night: 0x9d8e40 } },
      { palette: 3, steps: 16, start: 4, hold: STORM_HOLD, at: { night: 0x9d8e40 } },
      { palette: 4, steps: 16, start: 10, hold: STORM_HOLD, at: { night: 0x9d8e40 } },
      { palette: 7, steps: 8, start: 0, hold: 6, at: { night: 0x9d9200 } },
    ],
  },
  ruins: {
    // the one stage of lighting 6: `fire` is already the palette a burning body is on
    ids: { embers: 12 },
    layers: [
      { name: "sky", scroll: [0.5, 64], draw: [[BG2, { rows: FAR_ROWS }]] },
      { name: "ruins", scroll: [1, 0], draw: [[BG1]] },
    ],
    leftOut: [[BG2, { rows: FRONT_ROWS }]],
    cycles: [
      { palette: 4, steps: 16, start: 0, hold: 4, at: { embers: 0x0ac5c7 } },
      { palette: 5, steps: 16, start: 8, hold: 4, at: { embers: 0x0ac5c7 } },
      { palette: 6, steps: 16, start: 12, hold: 4, at: { embers: 0x0ac5c7 } },
    ],
  },
};

export interface ExportedArena {
  file: ArenaFile;
  /** `<layer>@<time>` → its picture. */
  images: Record<string, Rgba>;
}

/** 16 colours a row, a row per step, at their place in the ROM. */
function cycleSteps(rom: Uint8Array, at: number, steps: number): Rgba {
  const from = toFile(at);
  if (from === null) throw new Error(`palette steps at ${at.toString(16)} are not in ROM`);
  const data = new Uint8Array(16 * steps * 4);
  for (let i = 0; i < 16 * steps; i++) {
    const c = rom[from + 2 * i] | (rom[from + 2 * i + 1] << 8);
    data.set([(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3, 255], i * 4);
  }
  return { width: 16, height: steps, data };
}

/** Whether a picture of colour numbers holds any colour of these palettes. */
function holds(numbers: Rgba, palettes: number[]): boolean {
  for (let i = 0; i < numbers.data.length; i += 4) {
    if (numbers.data[i + 3] && palettes.includes(numbers.data[i] >> 4)) return true;
  }
  return false;
}

/** Each layer in each lighting, with what the cycling palettes repaint. That they add up to the stage is `arena.test.ts`'s to check. */
export function exportArena(rom: Uint8Array, source: ArenaSource): ExportedArena {
  const images: Record<string, Rgba> = {};
  const cycles = source.cycles ?? [];
  const palettes = cycles.map((c) => c.palette);
  const numbered = new Set<string>();
  for (const [time, id] of Object.entries(source.ids)) {
    const stage = loadStage(rom, id);
    for (const { name, draw } of source.layers) {
      images[`${name}@${time}`] = stack(...draw.map(([map, part]) => drawLayer(stage, map, part)));
      const numbers = stack(...draw.map(([map, part]) => numberLayer(stage, map, part)));
      if (!holds(numbers, palettes)) continue;
      numbered.add(name);
      images[`${name}-numbers@${time}`] = numbers;
    }
    cycles.forEach((c, i) => {
      images[`cycle${i}@${time}`] = cycleSteps(rom, c.at[time], c.steps);
    });
  }
  return {
    file: {
      times: Object.keys(source.ids),
      layers: source.layers.map(({ name, scroll }) => ({ name, scroll, ...(numbered.has(name) && { numbered: true }) })),
      ...(cycles.length > 0 && { cycles: cycles.map(({ palette, steps, start, hold }) => ({ palette, steps, start, hold })) }),
    },
    images,
  };
}
