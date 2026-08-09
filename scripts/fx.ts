/**
 * Generate the effect entities: `npm run fx`
 *
 * Writes a complete entity from nothing but code — the atlas PNG *and* its
 * `frames.json` / `animations.json`. No sheet to frame, no editor round-trip,
 * because the script already knows where every pixel went.
 *
 * The art itself is drawn by `src/fx.ts` (pure, unit-tested). This file only
 * turns grids into a PNG and into our data format. Re-running is safe: the
 * generator is seeded, so the same command produces the same bytes.
 *
 * Why generated at all: no ripped hit spark exists for this game (see
 * docs/plan.md). Regenerating also means the effect is *ours*, so unlike the
 * ripped sheets it could be committed — for now it is treated like the atlas,
 * which is to say derived and gitignored.
 *
 *   npm run fx                 # write every effect entity
 *   npm run fx -- --dry-run    # report only
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { bounds, FX_PALETTE, spark, sparkVariants, type Grid } from "../src/fx";
import { encodePng } from "./png";

/** One entity this script owns, end to end. */
interface Effect {
  /** Entity name — its directory under data/entities and its atlas file. */
  name: string;
  /** Distance from centre to spike tip, in sprite px. */
  reach: number;
  /** Seed: change it to redraw the same effect differently. */
  seed: number;
  /** Frames each step is held for, at 60 FPS. */
  durations: number[];
  /**
   * How many squashed variants to draw. Each becomes its own animation
   * (`hit0`, `hit1`, …) and the engine picks one at random per hit, so a run of
   * blows does not look like the same stamp printed repeatedly. One variant
   * (the default) is drawn round, as a single `hit`.
   */
  variants?: number;
}

/**
 * Sparks for physical blows, one per reaction an attack can ask for. Size comes
 * from a screenshot of the original — the flash covers about a quarter of a
 * fighter's height, and Goku is 81 px tall, so ~20 px for a solid hit.
 *
 * They are deliberately brief: 6 game frames is ~100 ms *after* the hit pause,
 * which holds the first frame for another 6 on top. The first version ran for
 * 15 and that alone made it read as an explosion rather than an impact.
 *
 * Only sparks are generated. `explosion()` exists in src/fx.ts for ki blasts and
 * specials, but nothing uses it yet, so no entity is written for it — dead data
 * is worse than a missing line here.
 */
const EFFECTS: Effect[] = [
  { name: "fx_hit", reach: 13, seed: 1337, durations: [2, 1, 1, 2], variants: 4 },
  { name: "fx_hit_heavy", reach: 17.5, seed: 4242, durations: [2, 2, 1, 2], variants: 4 },
];

/** Lay the variants out one per row, frames along it, and paint them. */
function sheet(variants: Grid[][]): {
  width: number;
  height: number;
  data: Uint8Array;
  rects: Rect[];
} {
  const gap = 1;
  const size = variants[0][0].size;
  const perRow = Math.max(...variants.map((v) => v.length));
  const width = perRow * (size + gap) + gap;
  const height = variants.length * (size + gap) + gap;
  const data = new Uint8Array(width * height * 4);
  const rects: Rect[] = [];

  variants.forEach((frames, row) => {
    frames.forEach((g, i) => {
      const ox = gap + i * (size + gap);
      const oy = gap + row * (size + gap);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const v = g.px[y * size + x];
          if (v === 0) continue;
          const [r, gg, b] = FX_PALETTE[v];
          const di = ((oy + y) * width + ox + x) * 4;
          data[di] = r;
          data[di + 1] = gg;
          data[di + 2] = b;
          data[di + 3] = 255;
        }
      }
      // The frame rect hugs the drawn pixels, like the character sheets do, so a
      // hurt box derived from a rect would mean the same thing here.
      const b = bounds(g) ?? { x: 0, y: 0, w: size, h: size };
      rects.push({
        x: ox + b.x,
        y: oy + b.y,
        w: b.w,
        h: b.h,
        cx: (size - 1) / 2 - b.x,
        cy: (size - 1) / 2 - b.y,
      });
    });
  });

  return { width, height, data, rects };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the burst's centre sits inside the rect — the anchor. */
  cx: number;
  cy: number;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const root = process.cwd();

  for (const fx of EFFECTS) {
    const count = fx.variants ?? 1;
    const variants: Grid[][] =
      count > 1 ? sparkVariants(fx.reach, fx.seed, count) : [spark(fx.reach, fx.seed)];

    for (const v of variants) {
      if (v.length !== fx.durations.length) {
        throw new Error(`${fx.name}: ${v.length} frames but ${fx.durations.length} durations`);
      }
    }

    // Every variant's frames go into one atlas, one row per variant, and each
    // becomes its own animation. The engine treats an effect's animations as
    // interchangeable and picks one, so adding a variant is a data change only.
    const { width, height, data, rects } = sheet(variants);

    const framesJson: Record<string, unknown> = {};
    rects.forEach((r, i) => {
      framesJson[String(i)] = {
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        anchor: [Math.round(r.cx), Math.round(r.cy)],
      };
    });

    const perVariant = fx.durations.length;
    const animations: Record<string, unknown> = {};
    variants.forEach((_, v) => {
      animations[count > 1 ? `hit${v}` : "hit"] = {
        loop: false,
        steps: fx.durations.map((dur, i) => ({ frame: String(v * perVariant + i), dur })),
      };
    });

    console.log(
      `${fx.name}: ${count} variant(s) x ${perVariant} frames, sprite ${variants[0][0].size}px` +
        `, atlas ${width}x${height}, ${fx.durations.reduce((a, b) => a + b, 0)} game frames each`,
    );
    if (dryRun) continue;

    const atlas = path.join(root, "assets", "atlases", `${fx.name}.png`);
    await fs.mkdir(path.dirname(atlas), { recursive: true });
    await fs.writeFile(atlas, encodePng({ width, height, data }));

    const dir = path.join(root, "data", "entities", fx.name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "frames.json"), JSON.stringify(framesJson, null, 2) + "\n");
    await fs.writeFile(path.join(dir, "animations.json"), JSON.stringify(animations, null, 2) + "\n");
    console.log(`  wrote ${path.relative(root, atlas)} and data/entities/${fx.name}/`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
