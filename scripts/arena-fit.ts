/**
 * An arena against pictures of the original's screen (`shots` in a scenario of
 * tools/re/runs/, `npm run original`), for each the camera that explains it best:
 *
 *   npm run arena-fit -- palace day logs/run-stage-palace-f1800.png
 *
 * The fighters and the HUD never agree, so a good match is some 90%, not all.
 */

import { readFileSync } from "node:fs";
import { fitArena } from "../src/rom/arenaFit.ts";
import { decodePng } from "../src/sprites/png.ts";
import type { ArenaFile } from "../src/arena/arenaFile.ts";

const [name, time, ...shots] = process.argv.slice(2);
if (!name || !time || !shots.length) throw new Error("npm run arena-fit -- <arena> <time> <screenshot.png …>");
const file = JSON.parse(readFileSync(`data/arenas/${name}/arena.json`, "utf8")) as ArenaFile;
const layers = file.layers.map(({ name: layer, scroll }) => ({
  scroll,
  image: decodePng(readFileSync(`assets/arenas/${name}/${layer}@${time}.png`)),
}));
for (const shot of shots) {
  const { x, y, share } = fitArena(layers, decodePng(readFileSync(shot)));
  console.log(`${shot}: camera x ${x}, arena ${y} px down, ${(share * 100).toFixed(1)}% agree`);
}
