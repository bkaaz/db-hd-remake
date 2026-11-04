import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fall } from "./air";
import { DEFAULT_ATTRIBUTES } from "./entityFile";
import type { StatesFile } from "./states";

const dir = (name: string) => `data/spawns/${name}`;
const launched = readdirSync("data/spawns").flatMap((name) => {
  if (!existsSync(`${dir(name)}/states.json`)) return [];
  const { states } = JSON.parse(readFileSync(`${dir(name)}/states.json`, "utf8")) as StatesFile;
  return Object.entries(states).flatMap(([state, def]) => (def.airborne && def.launch ? [{ name, state, vy: def.launch[1] as number }] : []));
});

describe("an object in flight", () => {
  it("is there to test: Masenko's shot among them", () => {
    expect(launched.map((l) => l.name)).toContain("gohan_masenko");
  });

  // logs/objects-gohan.txt: vy −3.00 every frame, as logs/objects-vegeta.txt shows for the falling shots
  it.each(launched)("$name keeps b0's vy the whole flight: a body's gravity is not an object's", ({ name, vy }) => {
    const at = `${dir(name)}/attributes.json`;
    const own = existsSync(at) ? JSON.parse(readFileSync(at, "utf8")) : {};
    const { gravity } = { ...DEFAULT_ATTRIBUTES, ...own };
    expect(fall({ aloft: true, gravity: "own", toApex: false, vx: 0, vy }, gravity)).toBe(vy);
  });
});
