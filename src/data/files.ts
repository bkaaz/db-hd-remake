/**
 * The committed `data/`, as the game reads it: through Vite's glob, so the
 * dev server and a static build read it the same way and no server is asked
 * (plan.md, a static build). Each file is its own chunk, fetched when first
 * read; what directories hold comes from the paths alone.
 *
 * The entity editor still writes through the dev server's `/api/section`.
 */

import type { EntityFile } from "../entity/entityFile";
import type { PalettesFile } from "../entity/palettesFile";

const FILES = import.meta.glob<unknown>("/data/**/*.json", { import: "default" });

/** `data/<path>`, or null when there is no such file. */
export async function readData<T>(path: string): Promise<T | null> {
  const load = FILES[`/data/${path}`];
  return load ? ((await load()) as T) : null;
}

/** The names of the directories under `data/<dir>/`, sorted. */
export function dataDirs(dir: string): string[] {
  const prefix = `/data/${dir}/`;
  const names = new Set<string>();
  for (const path of Object.keys(FILES)) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    if (rest.includes("/")) names.add(rest.split("/")[0]);
  }
  return [...names].sort();
}

/**
 * An entity assembled from its section files — a fighter's under
 * `data/entities/`, a spawn's under `data/spawns/` — or null for neither.
 */
export async function readEntity(name: string): Promise<EntityFile | null> {
  for (const dir of ["entities", "spawns"]) {
    const prefix = `/data/${dir}/${name}/`;
    const sections = Object.keys(FILES).filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"));
    if (sections.length === 0) continue;
    const entity: Record<string, unknown> = { name, frames: {}, animations: {} };
    await Promise.all(
      sections.map(async (p) => {
        entity[p.slice(prefix.length, -".json".length)] = await FILES[p]();
      }),
    );
    return entity as unknown as EntityFile;
  }
  return null;
}

/** Each fighter's colour sets of our own, by name (`palettes.json`). */
export async function colourSets(): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const name of dataDirs("entities")) {
    const file = await readData<PalettesFile>(`entities/${name}/palettes.json`);
    if (file) out[name] = Object.keys(file.sets);
  }
  return out;
}

/** Every arena and the lightings it has. */
export async function arenaList(): Promise<{ name: string; times: string[] }[]> {
  return Promise.all(
    dataDirs("arenas").map(async (name) => ({ name, times: (await readData<{ times?: string[] }>(`arenas/${name}/arena.json`))?.times ?? [] })),
  );
}
