import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every frame the committed data names lies on its sheet, and every variant
 * sheet is its base's size. The sheets are BYOA and written apart from the
 * data — an export that kept an entity's data but redrew its sheet left Final
 * Flash's large head a frame past the sheet's edge, drawn as nothing, which
 * no error said. Skipped for a sheet that is not here.
 */

const root = fileURLToPath(new URL("../../", import.meta.url));

/** A PNG's width and height, from its IHDR chunk. */
function size(path: string): [number, number] {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const sheets: { data: string; sheet: string }[] = [
  ...readdirSync(root + "data/entities").map((n) => ({ data: `data/entities/${n}`, sheet: `assets/sheets/${n}` })),
  ...readdirSync(root + "data/spawns").map((n) => ({ data: `data/spawns/${n}`, sheet: `assets/sheets/spawns/${n}` })),
].filter(({ data, sheet }) => existsSync(`${root}${data}/frames.json`) && existsSync(`${root}${sheet}.png`));

describe("sheets against their frames", () => {
  for (const { data, sheet } of sheets) {
    it(`${sheet}.png holds every frame of ${data}`, () => {
      const [w, h] = size(`${root}${sheet}.png`);
      const frames = JSON.parse(readFileSync(`${root}${data}/frames.json`, "utf8")) as Record<string, { x: number; y: number; w: number; h: number }>;
      const outside = Object.entries(frames).filter(([, f]) => f.x < 0 || f.y < 0 || f.x + f.w > w || f.y + f.h > h);
      expect(outside.map(([id]) => id)).toEqual([]);
      const dir = sheet.slice(0, sheet.lastIndexOf("/"));
      const base = sheet.slice(dir.length + 1);
      for (const variant of readdirSync(root + dir).filter((f) => f.startsWith(`${base}@`) && f.endsWith(".png")))
        expect([variant, ...size(`${root}${dir}/${variant}`)]).toEqual([variant, w, h]);
    });
  }
});
