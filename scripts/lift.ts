/**
 * Lift effect frames out of a fighter's sheet into spawn entities: `npm run lift`
 *
 * A ki bolt and its burst are entities of their own — they move and outlive the
 * animation that fired them — but their art was drawn on the fighter's sheet.
 * This copies those pixels into `assets/sheets/spawns/` and writes the entity
 * beside it, the way `npm run fx` does for the generated sparks. The fighter's
 * sheet is only read: nothing here modifies it.
 *
 * **The source rects are written out here in full, on purpose.** They were
 * `data/entities/goku/frames.json` entries 56-70 until the ki blast got its own
 * entity; keeping a copy is what lets those entries be deleted from the fighter
 * without this command losing the ability to rebuild a gitignored PNG.
 *
 *   npm run lift               # write every spawn below
 *   npm run lift -- --dry-run  # report only
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { liftFrames, type SrcRect } from "../src/sprites/lift";
import { decodePng, encodePng } from "../src/sprites/png";

/** One frame taken from the source sheet, and how long it is held. */
interface Frame extends SrcRect {
  /** Its id in the source entity's `frames.json` — provenance, nothing reads it. */
  id: number;
  /** Frames at 60 FPS. */
  dur: number;
}

/** One way the spawn can look, and the frames it is made of. */
interface Anim {
  name: string;
  loop: boolean;
  frames: Frame[];
}

interface Lift {
  /** Spawn name: its directory under `data/spawns` and its sheet file. */
  name: string;
  /** Source sheet under `assets/sheets/`. */
  from: string;
  /**
   * Give every frame a hit box covering the whole sprite — what a projectile
   * needs to hurt anybody, and derivable, so it is computed rather than drawn.
   * Tighten it in the editor if the tail should not count; re-running overwrites.
   */
  hits?: boolean;
  /**
   * One entry per way this spawn can look. A bolt drawn once for the level shot
   * and once for the climbing one is **one entity with two animations**, not two
   * entities: how it looks and how it travels are different questions, and the
   * flight already lives in the spawn's own `states.json`.
   */
  anims: Anim[];
}

/**
 * Goku's ki blast, in two pieces because the engine treats them differently:
 * the bolt is a body in flight, the burst is fire-and-forget like a spark and
 * so can be named as any attack's `hitFx`.
 *
 * The bolts travel left on the sheet; a mirror at spawn is exact, so nothing
 * needed redrawing. Order for the burst is the owner's (2026-08-24) and is not
 * the numeric one — 62 and 64 belong to the large burst.
 */
const LIFTS: Lift[] = [
  {
    name: "ki_bolt",
    from: "goku.png",
    hits: true,
    anims: [
      {
        name: "fly",
        loop: true,
        frames: [
          { id: 57, x: 148, y: 883, w: 24, h: 12, dur: 3 },
          { id: 58, x: 176, y: 884, w: 16, h: 10, dur: 3 },
        ],
      },
    ],
  },
  {
    name: "ki_burst",
    from: "goku.png",
    anims: [
      // `v1` because an effect's animations are interchangeable takes and the
      // engine picks one at random — a second take would be `v2`, no code change.
      {
        name: "v1",
        loop: false,
        frames: [
          { id: 60, x: 195, y: 881, w: 16, h: 16, dur: 2 },
          { id: 61, x: 213, y: 881, w: 16, h: 16, dur: 2 },
          { id: 63, x: 231, y: 881, w: 16, h: 16, dur: 2 },
          { id: 65, x: 249, y: 881, w: 16, h: 16, dur: 2 },
          { id: 66, x: 267, y: 883, w: 16, h: 16, dur: 2 },
          { id: 67, x: 287, y: 883, w: 12, h: 13, dur: 2 },
        ],
      },
    ],
  },
  {
    name: "kame_bolt",
    from: "goku.png",
    hits: true,
    anims: [
      {
        name: "fly",
        loop: true,
        frames: [
          { id: 134, x: 260, y: 1708, w: 31, h: 24, dur: 3 },
          { id: 135, x: 294, y: 1708, w: 31, h: 24, dur: 3 },
        ],
      },
      // The climbing shot's head (owner, 2026-08-25). A ball with its spikes
      // thrown outward rather than a comet lying along its flight, which is
      // what lets one drawing serve a diagonal nothing is allowed to rotate.
      {
        name: "fly_up",
        loop: true,
        frames: [{ id: 136, x: 331, y: 1704, w: 31, h: 31, dur: 3 }],
      },
    ],
  },
  {
    name: "ki_burst_big",
    from: "goku.png",
    anims: [
      // The large burst, which grows where the small one scatters. 63, 65-67
      // belong to the small one and are lifted as `ki_burst`.
      {
        name: "v1",
        loop: false,
        frames: [
          { id: 62, x: 228, y: 920, w: 16, h: 16, dur: 2 },
          { id: 64, x: 247, y: 915, w: 26, h: 26, dur: 2 },
          { id: 68, x: 276, y: 913, w: 26, h: 29, dur: 2 },
          { id: 69, x: 304, y: 912, w: 28, h: 31, dur: 2 },
          { id: 70, x: 336, y: 912, w: 29, h: 31, dur: 3 },
        ],
      },
    ],
  },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const root = process.cwd();
  const sources = new Map<string, Awaited<ReturnType<typeof decodePng>>>();

  for (const lift of LIFTS) {
    let src = sources.get(lift.from);
    if (!src) {
      const file = path.join(root, "assets", "sheets", lift.from);
      src = decodePng(await fs.readFile(file));
      sources.set(lift.from, src);
    }

    // Every animation's frames go into one sheet, in order, and each animation
    // then names the slice of it that is hers.
    const all = lift.anims.flatMap((a) => a.frames);
    const { sheet, frames } = liftFrames(src, all);
    const framesJson: Record<string, unknown> = {};
    frames.forEach((f, i) => {
      framesJson[String(i)] = { x: f.x, y: f.y, w: f.w, h: f.h, anchor: f.anchor };
    });

    const animations: Record<string, unknown> = {};
    let at = 0;
    for (const anim of lift.anims) {
      animations[anim.name] = {
        loop: anim.loop,
        steps: anim.frames.map((f, i) => ({
          frame: String(at + i),
          dur: f.dur,
          // Box coordinates are anchor-relative, and these frames are anchored
          // at their own centre, so the sprite's own rect is the box.
          ...(lift.hits
            ? {
                boxes: [
                  {
                    type: "hit",
                    x: -frames[at + i].anchor[0],
                    y: -frames[at + i].anchor[1],
                    w: f.w,
                    h: f.h,
                  },
                ],
              }
            : {}),
        })),
      };
      at += anim.frames.length;
    }

    console.log(
      `${lift.name}: ${all.length} frames from ${lift.from} (${all.map((f) => f.id).join(", ")})` +
        `, ${lift.anims.length} animation(s), sheet ${sheet.width}x${sheet.height}`,
    );
    if (dryRun) continue;

    const sheetFile = path.join(root, "assets", "sheets", "spawns", `${lift.name}.png`);
    await fs.mkdir(path.dirname(sheetFile), { recursive: true });
    await fs.writeFile(sheetFile, encodePng(sheet));

    const dir = path.join(root, "data", "spawns", lift.name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "frames.json"), JSON.stringify(framesJson, null, 2) + "\n");
    await fs.writeFile(
      path.join(dir, "animations.json"),
      JSON.stringify(animations, null, 2) + "\n",
    );
    console.log(`  wrote ${path.relative(root, sheetFile)} and data/spawns/${lift.name}/`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
