/**
 * An arena, taken from the cartridge into the shape the game reads
 * (`arena/arenaFile.ts`): its layers, cut where they scroll differently,
 * drawn once per lighting. Which rows move apart is the arena's own handler,
 * read by hand (`rom.md`, How a stage's layers scroll) and written here.
 */

import type { ArenaFile } from "../arena/arenaFile";
import type { Rgba } from "../sprites/png";
import { BG1, BG2, drawLayer, loadStage, stack } from "./stage";

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
