import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StateDef, StatesFile } from "./states";

/**
 * A bolt nothing ends stands where it was put and strikes for the rest of the
 * round: `Projectiles.update` removes one only for what is checked here. Data,
 * not code, so it reads every fighter's and fails on the file that forgot.
 */

const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

function ends(def: StateDef): boolean {
  const flies = def.launch !== undefined || (def.vel !== undefined && def.vel[0] !== 0) || def.aim !== undefined;
  return def.lasts !== undefined || def.endsWithMove !== undefined || def.burstsAbove !== undefined || flies;
}

const fighters = readdirSync("data/entities").filter((name) => existsSync(`data/entities/${name}/states.json`));

describe("every bolt a fighter fires", () => {
  it.each(fighters)("%s: has something that ends it", (fighter) => {
    const { states } = read<StatesFile>(`data/entities/${fighter}/states.json`);
    const endless: string[] = [];
    for (const def of Object.values(states)) {
      const fires = def.fires;
      if (!fires) continue;
      for (const shot of [fires, ...(fires.also ?? [])]) {
        const name = shot.spawn ?? fires.spawn;
        const path = `data/spawns/${name}/states.json`;
        if (!existsSync(path)) continue;
        const bolt = read<StatesFile>(path);
        const state = bolt.states[shot.state ?? fires.state ?? bolt.initial];
        if (state && !ends(state)) endless.push(name);
      }
    }
    expect([...new Set(endless)]).toEqual([]);
  });
});
